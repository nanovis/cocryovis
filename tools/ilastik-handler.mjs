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
const execPromise = promisify(exec);

/**
 * @typedef { import("@prisma/client").Volume } VolumeDB
 * @typedef { import("@prisma/client").RawVolumeData } RawVolumeDataDB
 * @typedef { import("@prisma/client").SparseLabelVolumeData } SparseLabelVolumeDataDB
 * @typedef { import("@prisma/client").PseudoLabelVolumeData } PseudoLabelVolumeDataDB
 */

class IlastikHandlerTaskHistory {
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

export default class IlastikHandler {
    static rawDataset = "/raw_data";
    static labelsDataset = "/labels";
    static pseudoLabelsDataset = "/pseudo_labels";

    /** @type {TaskQueue} */ #taskQueue;
    /** @type {IlastikHandlerTaskHistory[]} */ taskHistory = [];

    constructor(config) {
        this.config = config;
        this.#taskQueue = new TaskQueue();

        Object.preventExtensions(this);
    }

    isInferenceRunning() {
        return this.#taskQueue.hasPendingTask;
    }

    /**
     * @returns {{userId: Number, volumeId: Number}[]}
     */
    get queuedIdentifiers() {
        return this.#taskQueue.queuedIdentifiers;
    }

    async getVersion() {
        const command = `${this.config.python} -c \"import ilastik; print ilastik.__version__\"`;
        const { stdout, stderr } = await execPromise(command);
        return stdout;
    }

    /**
     * @param {Number} volumeId
     * @param {Number} userId
     * @param {String?} outputPath
     * @returns {Promise<void>}
     */
    async queueLabelGeneration(volumeId, userId, outputPath = null) {
        if (this.#taskQueue.size >= this.config.maxQueueSize) {
            throw new Error(
                "Failed Attempt to queue label generation: Too many tasks in queue."
            );
        }

        const volume = await Volume.getByIdDeep(volumeId, {
            rawData: true,
            sparseVolumes: true,
            pseudoVolumes: true,
        });

        IlastikHandler.#checkVolumeProperties(volume);

        Volume.connectionLockCheck(volumeId, PseudoLabeledVolumeData.modelName);

        if (!outputPath) {
            outputPath = Utils.createTemporaryFolder(this.config.workCache);
        }

        if (
            Volume.lockManager.isLockBlocked(volumeId, [
                RawVolumeData.modelName,
                SparseLabeledVolumeData.modelName,
            ]) ||
            User.lockManager.isLockBlocked(userId)
        ) {
            throw new Error(
                "Cannot start the label generation as the resources are currently used by another proccess."
            );
        }

        const volumeLock = Volume.lockManager.requestLock(volumeId, [
            RawVolumeData.modelName,
            SparseLabeledVolumeData.modelName,
        ]);
        const userLock = User.lockManager.requestLock(userId);

        this.#taskQueue.enqueue(
            () =>
                this.#generateLabels(
                    volumeId,
                    volumeLock,
                    userId,
                    userLock,
                    outputPath
                ),
            { userId: userId, volumeId: volumeId }
        );
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
            this.config.path + this.config.inference + " " + params.join(" ");

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
            this.config.model_file_name
        );
        const rawDataFullPath =
            path.resolve(rawDataPath) + IlastikHandler.rawDataset;
        const sparseLabelFullPath =
            path.resolve(sparseLabelPath) + IlastikHandler.labelsDataset;
        let params = [
            this.config.scripts_path + this.config.create_project_command,
            modelOutputFullPath,
            '"' + rawDataFullPath + '"',
            '"' + sparseLabelFullPath + '"',
        ];
        const command = this.config.python + " " + params.join(" ");

        const { stdout, stderr } = await execPromise(command);
        await logFile.writeLog(`stdout: \n${stdout}\nstderr: \n${stderr}`);

        return modelOutputFullPath;
    }

    /**
     * @param {Number} volumeId
     * @param {Number} volumeLock
     * @param {Number} userId
     * @param {Number} userLock
     * @param {String} outputPath
     * @returns {Promise<void>}
     */
    async #generateLabels(volumeId, volumeLock, userId, userLock, outputPath) {
        const logFile = await LogFile.createLogFile("label-generation");

        try {
            const volume = await Volume.getByIdDeep(volumeId, {
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
                throw new Error(
                    "Pseudo Labels Generation error: The generation only supports uint8 data format."
                );
            }
            if (!Object.hasOwn(settings, "size")) {
                throw new Error(
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
                    throw new Error(
                        "Pseudo Labels Generation error: The generation only supports uint8 data format."
                    );
                }
                if (!Object.hasOwn(settings, "size")) {
                    throw new Error(
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

            await Volume.addPseudoLabelsFromFolder(
                labelDirectory,
                userId,
                volume.id,
                volume.sparseVolumes
            );

            this.taskHistory.push(
                new IlastikHandlerTaskHistory(
                    userId,
                    volumeId,
                    IlastikHandlerTaskHistory.status.success,
                    logFile
                )
            );
        } catch (error) {
            console.log(`Ilastik label generation error: ${error}`);
            await logFile.writeLog(`exec error: ${error}`);
            this.taskHistory.push(
                new IlastikHandlerTaskHistory(
                    userId,
                    volumeId,
                    IlastikHandlerTaskHistory.status.fail,
                    logFile
                )
            );
        } finally {
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

            Volume.lockManager.removeLock(volumeLock);
            User.lockManager.removeLock(userLock);
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
            throw new Error(
                "Pseudo Labels Generation error: One or more inputs have missmatching dimensions."
            );
        }
    }

    /**
     * @param {VolumeDB & {rawData: RawVolumeDataDB, sparseVolumes: SparseLabelVolumeDataDB[], pseudoVolumes: PseudoLabelVolumeDataDB[]}} volume
     */
    static #checkVolumeProperties(volume) {
        if (
            volume.sparseVolumes.length + volume.pseudoVolumes.length >
            appConfig.maxVolumeChannels
        ) {
            throw new Error(
                "Volume does not have enough space to generate pseudo labels from sparse label set."
            );
        }

        if (!volume.rawData || !volume.rawData.rawFilePath) {
            throw new Error(
                "Pseudo Labels Generation error: Raw Data is missing."
            );
        }
        if (!volume.sparseVolumes || volume.sparseVolumes.length === 0) {
            throw new Error(
                "Pseudo Labels Generation error: Sparse Label Data is missing."
            );
        }
    }
}
