// @ts-check

import { exec } from "child_process";
import fileSystem from "fs";
import path from "path";
import fsPromises from "node:fs/promises";
import { H5ToLabels, labelsToH5, rawToH5 } from "./raw-to-h5.mjs";
import Utils from "./utils.mjs";
import { promisify } from "util";
import TaskQueue from "./task-queue.mjs";
import Volume from "../models/volume.mjs";
import appConfig from "./config.mjs";
import LogFile from "./log-manager.mjs";
import User from "../models/user.mjs";
import RawVolumeData from "../models/raw-volume-data.mjs";
import SparseLabeledVolumeData from "../models/sparse-labeled-volume-data.mjs";
import PseudoLabeledVolumeData from "../models/pseudo-labeled-volume-data.mjs";
import { WriteMultiLock } from "./write-lock-manager.mjs";
import { ApiError } from "./error-handler.mjs";
import WebSocketManager, { ActionTypes } from "./websocket-manager.mjs";
const execPromise = promisify(exec);

/**
 * @typedef { import("@prisma/client").Volume } VolumeDB
 * @typedef { import("@prisma/client").RawVolumeData } RawVolumeDataDB
 * @typedef { import("@prisma/client").SparseLabelVolumeData } SparseLabelVolumeDataDB
 * @typedef { import("@prisma/client").PseudoLabelVolumeData } PseudoLabelVolumeDataDB
 */

class TaskHistoryInstance {
    /** @type {Number} */ userId;
    /** @type {Number} */ volumeId;
    /** @type {String} */ taskStatus;
    /** @type {LogFile} */ logFile;

    static status = {
        success: "success",
        fail: "fail",
    };

    /**
     * @param {Number} userId
     * @param {Number} volumeId
     * @param {String} taskStatus
     * @param {LogFile} logFile
     */
    constructor(userId, volumeId, taskStatus, logFile) {
        this.userId = userId;
        this.volumeId = volumeId;
        this.taskStatus = taskStatus;
        this.logFile = logFile;

        Object.preventExtensions(this);
    }
}

class TaskHistory {
    /** @type {TaskHistoryInstance[]} */ #taskHistory = [];

    /** @param {TaskHistoryInstance} instance */
    async update(instance) {
        this.#taskHistory.push(instance);
        const userId = instance.userId;
        const userTaskHistory = await this.getUserTaskHistory(userId);
        WebSocketManager.broadcastAction(
            [userId],
            [],
            ActionTypes.IlastikTaskHistoryUpdated,
            userTaskHistory
        );
    }

    /**
     * @param {Number} userId
     */
    async getUserTaskHistory(userId) {
        const userTaskHistory = this.#taskHistory.filter(
            (t) => t.userId === userId
        );

        const volumes = await Volume.getByIds(
            userTaskHistory.map((i) => i.volumeId)
        );
        const volumeMap = Utils.arrayToMap(volumes, "id");

        const result = userTaskHistory.map(function (t) {
            const volume = volumeMap.get(t.volumeId);
            return {
                volumeName: volume.name,
                volumeId: volume.id,
                taskStatus: t.taskStatus,
                logFile: t.logFile.fileName,
            };
        });

        return result.reverse();
    }
}

export default class IlastikHandler {
    static rawDataset = "/raw_data";
    static labelsDataset = "/labels";
    static pseudoLabelsDataset = "/pseudo_labels";

    /** @type {TaskQueue} */ #taskQueue;
    /** @type {TaskHistory} */ taskHistory = new TaskHistory();

    constructor(config) {
        this.config = config;
        this.#taskQueue = new TaskQueue(
            this.#onTaskQueueChange.bind(this),
            this.#onTaskQueueChange.bind(this)
        );

        Object.preventExtensions(this);
    }

    isInferenceRunning() {
        return this.#taskQueue.hasPendingTask;
    }

    async #onTaskQueueChange() {
        const taskQueue = await this.getTaskQueue();
        WebSocketManager.broadcastAction(
            [],
            [],
            ActionTypes.IlastikQueueUpdated,
            taskQueue
        );
    }

    /**
     * @returns {{userId: Number, volumeId: Number}[]}
     */
    get queuedIdentifiers() {
        return this.#taskQueue.queuedIdentifiers;
    }

    async getVersion() {
        const command = `${this.config.ilastik.python} -c \"import ilastik; print ilastik.__version__\"`;
        const { stdout, stderr } = await execPromise(command);
        return stdout;
    }

    async getTaskQueue() {
        const users = await User.getByIds(
            this.queuedIdentifiers.map((i) => i.userId)
        );
        const usersMap = Utils.arrayToMap(users, "id");

        const volumes = await Volume.getByIds(
            this.queuedIdentifiers.map((i) => i.volumeId)
        );
        const volumeMap = Utils.arrayToMap(volumes, "id");

        return this.queuedIdentifiers.map(function (t) {
            const user = usersMap.get(t.userId);
            const volume = volumeMap.get(t.volumeId);
            return {
                userId: user.id,
                username: user.username,
                volumeName: volume.name,
                volumeId: volume.id,
            };
        });
    }

    /**
     * @param {Number} volumeId
     * @param {Number} userId
     * @param {String?} outputPath
     * @returns {Promise<void>}
     */
    async queueLabelGeneration(volumeId, userId, outputPath = null) {
        if (this.#taskQueue.size >= this.config.ilastikQueueSize) {
            throw new ApiError(
                400,
                "Failed Attempt to queue label generation: Too many tasks in queue."
            );
        }

        const volume = await Volume.getById(volumeId, {
            rawData: true,
            sparseVolumes: true,
            pseudoVolumes: true,
        });

        IlastikHandler.#checkVolumeProperties(volume);

        if (!outputPath) {
            outputPath = Utils.createTemporaryFolder(
                this.config.ilastik.workCache
            );
        }

        const multiLock = new WriteMultiLock([
            Volume.lockManager.generateLockInstance(volumeId, [
                RawVolumeData.modelName,
                SparseLabeledVolumeData.modelName,
                PseudoLabeledVolumeData.modelName,
            ]),
            User.lockManager.generateLockInstance(userId),
        ]);

        WriteMultiLock.withWriteMultiLock(multiLock, async () => {
            try {
                return await this.#taskQueue.enqueue(
                    () => this.#generateLabels(volumeId, userId, outputPath),
                    { userId: userId, volumeId: volumeId }
                );
            } catch {
                console.error(
                    `Label generation task by User with id ${userId} failed.`
                );
            }
        });
    }

    /**
     * @param {String} rawDataPath
     * @param {String} modelPath
     * @param {String} labelsOutputPath
     * @param {LogFile} logFile
     * @returns {Promise<String>}
     */
    async #runIlastikInference(
        rawDataPath,
        modelPath,
        labelsOutputPath,
        logFile
    ) {
        await logFile.writeLog("\n\nIlastik inference started\n");

        const rawDataFullPath =
            path.resolve(rawDataPath) + IlastikHandler.rawDataset;
        const modelFullPath = path.resolve(modelPath);
        const resultsFilePath = path.join(
            labelsOutputPath,
            `${path.parse(rawDataPath).name}_pseudo_labels.h5`
        );

        let params = [
            "--headless",
            `--project=\"${modelFullPath}\"`,
            '--output_format="hdf5"',
            '--export_source="Probabilities"',
            "--export_dtype=uint8",
            '--pipeline_result_drange="(0.0,1.0)"',
            '--export_drange="(0,255)"',
            `--output_internal_path=\"${IlastikHandler.pseudoLabelsDataset}\"`,
            `--output_filename_format=\"${resultsFilePath}\"`,
            '"' + rawDataFullPath + '"',
        ];
        const command =
            this.config.ilastik.path +
            this.config.ilastik.inference +
            " " +
            params.join(" ");

        const { stdout, stderr } = await execPromise(command);
        await logFile.writeLog(`stdout: \n${stdout}\nstderr: \n${stderr}`);

        return resultsFilePath;
    }

    /**
     * @param {String} rawDataPath
     * @param {String} sparseLabelPath
     * @param {String} outputPath
     * @param {LogFile} logFile
     * @returns {Promise<String>}
     */
    async #createIlastikProject(
        rawDataPath,
        sparseLabelPath,
        outputPath,
        logFile
    ) {
        await logFile.writeLog("\n\nCreating Ilastik project\n");

        const modelOutputFullPath = path.join(
            path.resolve(outputPath),
            this.config.ilastik.model_file_name
        );
        const rawDataFullPath =
            path.resolve(rawDataPath) + IlastikHandler.rawDataset;
        const sparseLabelFullPath =
            path.resolve(sparseLabelPath) + IlastikHandler.labelsDataset;
        let params = [
            path.join(
                this.config.ilastik.path,
                this.config.ilastik.scripts_path,
                this.config.ilastik.create_project_command
            ),
            modelOutputFullPath,
            '"' + rawDataFullPath + '"',
            '"' + sparseLabelFullPath + '"',
        ];
        const command = this.config.ilastik.python + " " + params.join(" ");

        const { stdout, stderr } = await execPromise(command);
        await logFile.writeLog(`stdout: \n${stdout}\nstderr: \n${stderr}`);

        return modelOutputFullPath;
    }

    /**
     * @param {Number} volumeId
     * @param {Number} userId
     * @param {String} outputPath
     * @returns {Promise<PseudoLabelVolumeDataDB[]>}
     */
    async #generateLabels(volumeId, userId, outputPath) {
        const logFile = await LogFile.createLogFile("label-generation");

        try {
            const volume = await Volume.getById(volumeId, {
                rawData: true,
                sparseVolumes: true,
                pseudoVolumes: true,
            });

            await logFile.writeLog("Stating label generation process\n\n");

            IlastikHandler.#checkVolumeProperties(volume);

            const settings = JSON.parse(volume.rawData.settings);
            if (
                !Object.hasOwn(settings, "bytesPerVoxel") ||
                settings.bytesPerVoxel != 1
            ) {
                throw new ApiError(
                    400,
                    "Pseudo Labels Generation error: The generation only supports uint8 data format."
                );
            }
            if (!Object.hasOwn(settings, "size")) {
                throw new ApiError(
                    400,
                    "Pseudo Labels Generation error: Missing data dimensions data."
                );
            }
            const dimensions = settings.size;
            for (const sparseLabel of volume.sparseVolumes) {
                const settings = JSON.parse(sparseLabel.settings);
                if (
                    !Object.hasOwn(settings, "bytesPerVoxel") ||
                    settings.bytesPerVoxel != 1
                ) {
                    throw new ApiError(
                        400,
                        "Pseudo Labels Generation error: The generation only supports uint8 data format."
                    );
                }
                if (!Object.hasOwn(settings, "size")) {
                    throw new ApiError(
                        400,
                        "Pseudo Labels Generation error: Missing data dimensions data."
                    );
                }
                IlastikHandler.#checkDimensions(dimensions, settings.size);
            }

            const rawH5FileName =
                path.parse(volume.rawData.rawFilePath).name + ".h5";
            const labelsH5FileName =
                path.parse(volume.rawData.rawFilePath).name + "_labels.h5";

            const rawH5Path = path.join(outputPath, rawH5FileName);
            const labelsH5Path = path.join(outputPath, labelsH5FileName);

            await logFile.writeLog("Converting raw data to HDF5 format...\n");
            await this.#convertDataToH5(
                volume.rawData,
                volume.sparseVolumes,
                dimensions,
                rawH5Path,
                labelsH5Path
            );
            await logFile.writeLog("Data conversion to HDF5 complete.");

            const modelFullPath = await this.#createIlastikProject(
                rawH5Path,
                labelsH5Path,
                outputPath,
                logFile
            );

            const resultPath = await this.#runIlastikInference(
                rawH5Path,
                modelFullPath,
                outputPath,
                logFile
            );

            const labelDirectory = path.join(outputPath, "labels");
            await fsPromises.mkdir(labelDirectory, {
                recursive: true,
            });
            await H5ToLabels(
                resultPath,
                IlastikHandler.pseudoLabelsDataset,
                labelDirectory
            );

            const pseudoLabeledVolumes = await Volume.addPseudoLabelsFromFolder(
                labelDirectory,
                userId,
                volume.id,
                volume.sparseVolumes
            );

            this.taskHistory.update(
                new TaskHistoryInstance(
                    userId,
                    volumeId,
                    TaskHistoryInstance.status.success,
                    logFile
                )
            );

            WebSocketManager.broadcastAction(
                [userId],
                [],
                ActionTypes.InsertPseudoVolumes,
                {
                    pseudoLabeledVolumes: pseudoLabeledVolumes,
                    volumeId: volumeId,
                }
            );

            return pseudoLabeledVolumes;
        } catch (error) {
            console.error(`Ilastik label generation error: ${error}`);
            await logFile.writeLog(`exec error: ${error}`);
            this.taskHistory.update(
                new TaskHistoryInstance(
                    userId,
                    volumeId,
                    TaskHistoryInstance.status.fail,
                    logFile
                )
            );
            throw error;
        } finally {
            if (appConfig.ilastik.cleanTemporaryFiles) {
                try {
                    await fsPromises.rm(outputPath, {
                        recursive: true,
                        force: true,
                    });
                } catch (error) {
                    console.error(
                        `Filed to remove ilastik inference cache: ${error}`
                    );
                }
            }
        }
    }

    /**
     * @param {RawVolumeDataDB} rawData
     * @param {SparseLabelVolumeDataDB[]} sparseLabelsStack
     * @param {{x: Number, y: Number, z: Number}} dimensions
     * @param {String} rawOutputPath
     * @param {String} labelsOutputPath
     */
    async #convertDataToH5(
        rawData,
        sparseLabelsStack,
        dimensions,
        rawOutputPath,
        labelsOutputPath
    ) {
        if (fileSystem.existsSync(rawOutputPath)) {
            await fsPromises.rm(rawOutputPath, {
                force: true,
            });
        }
        if (fileSystem.existsSync(labelsOutputPath)) {
            await fsPromises.rm(labelsOutputPath, {
                force: true,
            });
        }

        await rawToH5(
            rawData.rawFilePath,
            dimensions,
            rawOutputPath,
            IlastikHandler.rawDataset
        );
        await labelsToH5(
            sparseLabelsStack.map((l) => l.rawFilePath),
            dimensions,
            labelsOutputPath,
            IlastikHandler.labelsDataset
        );
    }

    /**
     * @typedef {{x: number, y: number, z:number}} Dimensions
     * @param {Dimensions} dim1
     * @param {Dimensions} dim2
     */
    static #checkDimensions(dim1, dim2) {
        if (!Utils.checkDimensions(dim1, dim2)) {
            throw new ApiError(
                400,
                "Pseudo Labels Generation error: One or more inputs have missmatching dimensions."
            );
        }
    }

    /**
     * @param {VolumeDB & {rawData: RawVolumeDataDB, sparseVolumes: SparseLabelVolumeDataDB[], pseudoVolumes: PseudoLabelVolumeDataDB[]}} volume
     */
    static #checkVolumeProperties(volume) {
        if (volume.sparseVolumes.length < 2) {
            throw new ApiError(
                400,
                "Pseudo Labels Generation error: Volume requires at least two sparse labels."
            );
        }

        if (
            volume.sparseVolumes.length + volume.pseudoVolumes.length >
            appConfig.maxVolumeChannels
        ) {
            throw new ApiError(
                400,
                "Pseudo Labels Generation error: Volume does not have enough empty space to pseudo label slots."
            );
        }

        if (!volume.rawData || !volume.rawData.rawFilePath) {
            throw new ApiError(
                400,
                "Pseudo Labels Generation error: Raw Data is missing."
            );
        }

        for (const sparseLabel of volume.sparseVolumes) {
            if (!sparseLabel || !sparseLabel.rawFilePath) {
                throw new ApiError(
                    400,
                    "Pseudo Labels Generation error: Sparse Label Data is missing."
                );
            }
        }
    }
}
