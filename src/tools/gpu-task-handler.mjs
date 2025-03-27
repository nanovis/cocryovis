// @ts-check

import path from "path";
import fileSystem from "fs";
import TaskQueue from "./task-queue.mjs";
import Utils from "./utils.mjs";
import fsPromises from "node:fs/promises";
import Checkpoint from "../models/checkpoint.mjs";
import Result from "../models/result.mjs";
import LogFile from "./log-manager.mjs";
import Volume from "../models/volume.mjs";
import User from "../models/user.mjs";
import Model from "../models/model.mjs";
import RawVolumeData from "../models/raw-volume-data.mjs";
import PseudoLabeledVolumeData from "../models/pseudo-labeled-volume-data.mjs";
import { WriteMultiLock } from "./write-lock-manager.mjs";
import { ApiError } from "./error-handler.mjs";
import WebSocketManager, { ActionTypes } from "./websocket-manager.mjs";
import fileUpload from "express-fileupload";
import { PendingLocalFile } from "./file-handler.mjs";
import TaskHistory from "../models/task-history.mjs";

/**
 * @typedef { import("@prisma/client").RawVolumeData } RawVolumeDataDB
 * @typedef { import("@prisma/client").PseudoLabelVolumeData } PseudoVolumeDataDB
 * @typedef { import("@prisma/client").Volume } VolumeDB
 * @typedef { import("@prisma/client").Result } ResultDB
 * @typedef { import("@prisma/client").Checkpoint } CheckpointDB
 * @typedef { VolumeDB & {rawData: RawVolumeDataDB, pseudoVolumes: PseudoVolumeDataDB[]} } DeepVolume
 */

export default class GPUTaskHandler {
    /** @type {TaskQueue} */ #taskQueue;

    constructor(config) {
        this.config = config;
        this.#taskQueue = new TaskQueue();
        this.gpuTaskTempDirectory = path.join(this.config.tempPath, "gpuTasks");
        Object.preventExtensions(this);
    }

    isInferenceRunning() {
        return this.#taskQueue.hasPendingTask;
    }

    createTemporaryOutputPath() {
        let tempFolderPath = path.join(
            this.gpuTaskTempDirectory,
            Utils.getInverseDateString()
        );
        while (fileSystem.existsSync(tempFolderPath)) {
            tempFolderPath += "_";
        }
        fileSystem.mkdirSync(tempFolderPath, { recursive: true });
        return tempFolderPath;
    }

    /**
     * @param {Number} checkpointId
     * @param {Number} volumeId
     * @param {Number} userId
     * @param {String?} outputPath
     * @returns {Promise<void>}
     */
    async queueInference(checkpointId, volumeId, userId, outputPath = null) {
        if (this.#taskQueue.size >= this.config.gpuQueueSize) {
            throw new ApiError(
                400,
                "Failed Attempt to start inference: Too many tasks in queue."
            );
        }

        const volume = await Volume.getById(volumeId, { rawData: true });
        const checkpoint = await Checkpoint.getById(checkpointId);

        GPUTaskHandler.#checkInferenceInput(volume, checkpoint);

        if (!outputPath) {
            outputPath = this.createTemporaryOutputPath();
        }

        const multiLock = new WriteMultiLock([
            Checkpoint.lockManager.generateLockInstance(checkpointId),
            Volume.lockManager.generateLockInstance(volumeId, [
                RawVolumeData.modelName,
            ]),
        ]);

        WriteMultiLock.withWriteMultiLock(multiLock, async () => {
            try {
                const taskHistory = await TaskHistory.create({
                    userId: userId,
                    volumeId: volumeId,
                    checkpointId: checkpointId,
                    taskType: TaskHistory.type.Inference,
                    taskStatus: TaskHistory.status.enqueued,
                    enqueuedTime: new Date(),
                });

                return await this.#taskQueue.enqueue(() =>
                    this.#runInference(
                        checkpointId,
                        volumeId,
                        userId,
                        outputPath,
                        taskHistory.id
                    )
                );
            } catch (error) {
                console.error(
                    `Inference task by User with id ${userId} failed.`
                );
            }
        });
    }

    /**
     * @param {Number} checkpointId
     * @param {Number} volumeId
     * @param {Number} userId
     * @param {String} outputPath
     * @param {Number} taskHistoryId
     * @returns {Promise<ResultDB>}
     */
    async #runInference(
        checkpointId,
        volumeId,
        userId,
        outputPath,
        taskHistoryId
    ) {
        const logFile = await LogFile.createLogFile("inference");
        let tempSettingsPath = null;

        try {
            await TaskHistory.update(taskHistoryId, {
                taskStatus: TaskHistory.status.running,
                startTime: new Date(),
                logFile: logFile.fileName,
            });

            const volume = await Volume.getById(volumeId, {
                rawData: true,
            });
            const checkpoint = await Checkpoint.getById(checkpointId);

            GPUTaskHandler.#checkInferenceInput(volume, checkpoint);

            tempSettingsPath = path.join(
                volume.rawData.path,
                `${Utils.stripExtension(volume.rawData.rawFilePath)}.json`
            );
            await fsPromises.writeFile(
                tempSettingsPath,
                volume.rawData.settings,
                "utf8"
            );

            fsPromises.mkdir(outputPath, { recursive: true });

            await logFile.writeLog("Nano-Oetzi inference started\n");

            const inferenceDataAbsolutePath = path.resolve(tempSettingsPath);
            const outputAbsolutePath = path.resolve(outputPath);

            if (!fileSystem.existsSync(outputAbsolutePath)) {
                fileSystem.mkdirSync(outputAbsolutePath, { recursive: true });
            }

            const checkpointAbsolutePath = path.resolve(checkpoint.filePath);
            let params = [
                "./" + this.config.nanoOetzi.inference.command,
                inferenceDataAbsolutePath,
                outputAbsolutePath,
                "-m",
                checkpointAbsolutePath,
            ];
            if (this.config.nanoOetzi.inference.cleanTemporaryFiles) {
                params.push("-c", "True");
            }

            await Utils.runScript(
                this.config.nanoOetzi.python,
                params,
                path.resolve(
                    path.join(
                        this.config.nanoOetzi.path,
                        this.config.nanoOetzi.scripts
                    )
                ),
                (value) => logFile.writeLog(value),
                (value) => logFile.writeLog(value)
            );

            await logFile.writeLog(
                `\n--------------\nNanoOetzi inference finished\n\nCreating results entry...\n`
            );

            const outputFile = await fsPromises.readFile(
                path.join(outputPath, "output.json"),
                "utf8"
            );

            const result = await Result.createFromFolder(
                userId,
                checkpointId,
                volume.rawData.id,
                volumeId,
                JSON.parse(outputFile.toString()),
                outputPath,
                logFile.fileName
            );

            await logFile.writeLog(
                `Result entry created.\n\nSaving task history...\n`
            );

            await TaskHistory.update(taskHistoryId, {
                taskStatus: TaskHistory.status.finished,
                endTime: new Date(),
            });

            await logFile.writeLog(
                `Task history saved.\n\nINFERENCE FINISHED!\n`
            );

            WebSocketManager.broadcastAction(
                [userId],
                [],
                ActionTypes.InsertResult,
                { result: result, volumeId: volumeId }
            );

            return result;
        } catch (error) {
            await logFile.writeLog(`--------------\n${error}`);
            console.error(`NanoOetzi inference error: ${error}`);
            try {
                await fsPromises.rm(outputPath, {
                    recursive: true,
                    force: true,
                });
            } catch (error) {
                console.error(
                    `Filed to remove nano oetzi inference cache: ${error}`
                );
            }
            await TaskHistory.update(taskHistoryId, {
                taskStatus: TaskHistory.status.failed,
                endTime: new Date(),
            });
            throw error;
        } finally {
            if (tempSettingsPath != null) {
                try {
                    await fsPromises.rm(tempSettingsPath, {
                        force: true,
                    });
                } catch {
                    console.error(
                        "Inference: Failed to remove the temporary setting file."
                    );
                }
            }
        }
    }

    /**
     * @param {Number} modelId
     * @param {Number} userId
     * @param {Number[]} trainingVolumesIds
     * @param {Number[]} validationVolumesIds
     * @param {Number[]} testingVolumesIds
     * @param {String?} outputPath
     * @param {boolean} removeTempFiles
     * @returns {Promise<Void>}
     */
    async queueTraining(
        modelId,
        userId,
        trainingVolumesIds,
        validationVolumesIds,
        testingVolumesIds,
        outputPath = null,
        removeTempFiles = true
    ) {
        if (!trainingVolumesIds || trainingVolumesIds.length == 0) {
            throw new ApiError(
                400,
                "Failed Attempt to start training: Missing training data."
            );
        }
        if (!validationVolumesIds || validationVolumesIds.length == 0) {
            throw new ApiError(
                400,
                "Failed Attempt to start training: Missing validation data."
            );
        }
        if (!testingVolumesIds || testingVolumesIds.length == 0) {
            throw new ApiError(
                400,
                "Failed Attempt to start training: Missing test data."
            );
        }
        if (this.#taskQueue.size >= this.config.gpuQueueSize) {
            throw new ApiError(
                400,
                "Failed Attempt to start inference: Too many tasks in queue."
            );
        }

        if (!outputPath) {
            outputPath = this.createTemporaryOutputPath();
        }

        const modelLock = Model.lockManager.generateLockInstance(modelId, [
            Checkpoint.modelName,
        ]);

        const volumeLocks = [];
        trainingVolumesIds.forEach((v) => {
            volumeLocks.push(
                Volume.lockManager.generateLockInstance(v, [
                    RawVolumeData.modelName,
                    PseudoLabeledVolumeData.modelName,
                ])
            );
        });

        validationVolumesIds.forEach((v) => {
            volumeLocks.push(
                Volume.lockManager.generateLockInstance(v, [
                    RawVolumeData.modelName,
                    PseudoLabeledVolumeData.modelName,
                ])
            );
        });

        testingVolumesIds.forEach((v) => {
            volumeLocks.push(
                Volume.lockManager.generateLockInstance(v, [
                    RawVolumeData.modelName,
                    PseudoLabeledVolumeData.modelName,
                ])
            );
        });

        const multiLock = new WriteMultiLock([modelLock, ...volumeLocks]);

        WriteMultiLock.withWriteMultiLock(multiLock, async () => {
            try {
                const taskHistory = await TaskHistory.create({
                    userId: userId,
                    modelId: modelId,
                    taskType: TaskHistory.type.Training,
                    taskStatus: TaskHistory.status.enqueued,
                    enqueuedTime: new Date(),
                });

                return await this.#taskQueue.enqueue(() =>
                    this.#runTraining(
                        modelId,
                        userId,
                        trainingVolumesIds,
                        validationVolumesIds,
                        testingVolumesIds,
                        outputPath,
                        taskHistory.id,
                        removeTempFiles
                    )
                );
            } catch (error) {
                console.error(
                    `Training task by User with id ${userId} failed.`
                );
            }
        });
    }

    /**
     * @param {Number} modelId
     * @param {Number} userId
     * @param {Number[]} trainingVolumesIds
     * @param {Number[]} validationVolumesIds
     * @param {Number[]} testingVolumesIds
     * @param {String} outputPath
     * @param {Number} taskHistoryId
     * @param {boolean} removeTempFiles
     * @returns {Promise<CheckpointDB>}
     */
    async #runTraining(
        modelId,
        userId,
        trainingVolumesIds,
        validationVolumesIds,
        testingVolumesIds,
        outputPath,
        taskHistoryId,
        removeTempFiles = true
    ) {
        const logFile = await LogFile.createLogFile("training");
        const workFolder = path.join(outputPath, "training-data");

        try {
            await TaskHistory.update(taskHistoryId, {
                taskStatus: TaskHistory.status.running,
                startTime: new Date(),
                logFile: logFile.fileName,
            });

            await logFile.writeLog(
                "Nano-Oetzi training started\n--------------\n"
            );

            await fsPromises.mkdir(workFolder, { recursive: true });

            await logFile.writeLog(`Creating training configuration file...\n`);

            const trainingVolumes = await Volume.getMultipleByIdDeep(
                trainingVolumesIds,
                { rawData: true, pseudoVolumes: true }
            );
            const validationVolumes = await Volume.getMultipleByIdDeep(
                validationVolumesIds,
                { rawData: true, pseudoVolumes: true }
            );
            const testingVolumes = await Volume.getMultipleByIdDeep(
                testingVolumesIds,
                { rawData: true, pseudoVolumes: true }
            );

            const configPath = await this.#writeTrainingConfigFile(
                trainingVolumes,
                validationVolumes,
                testingVolumes,
                workFolder
            );

            await logFile.writeLog(
                `Training configuration file created successfully.\n`
            );

            const configAbsolutePath = path.resolve(configPath);
            const outputAbsolutePath = path.resolve(workFolder);

            await logFile.writeLog(
                "Converting raw data into pytorch tensors...\n"
            );

            await Utils.runScript(
                this.config.nanoOetzi.python,
                [
                    path.join("./python-scripts", "raws-to-train-sets.py"),
                    "-i",
                    configAbsolutePath,
                    "-o",
                    outputAbsolutePath,
                ],
                null,
                (value) => logFile.writeLog(value),
                (value) => logFile.writeLog(value)
            );

            await logFile.writeLog(
                `\n--------------\nSuccess.\n\nLauching training script...\n`
            );

            await Utils.runScript(
                this.config.nanoOetzi.python,
                [
                    this.config.nanoOetzi.training.command,
                    outputAbsolutePath,
                    "--min_epochs",
                    this.config.nanoOetzi.training.min_epochs,
                    "--max_epochs",
                    this.config.nanoOetzi.training.max_epochs,
                ],
                path.resolve(
                    path.join(
                        this.config.nanoOetzi.path,
                        this.config.nanoOetzi.scripts
                    )
                ),
                (value) => logFile.writeLog(value),
                (value) => logFile.writeLog(value)
            );

            await logFile.writeLog(
                `\n--------------\nSuccess.\n\nSearching for training results file...\n`
            );

            const trainingResultsPath = path.join(
                workFolder,
                "results",
                "result.json"
            );
            const trainingResults = await fsPromises.readFile(
                trainingResultsPath
            );
            const trainingResultsJSON = JSON.parse(trainingResults.toString());

            const bestModelPath = trainingResultsJSON.best_model_path;
            const newBestModelPath = path.join(
                outputPath,
                path.basename(bestModelPath)
            );

            await fsPromises.rename(bestModelPath, newBestModelPath);

            const labelIds = [];
            for (const trainingVolume of trainingVolumes) {
                for (const pseudoVolume of trainingVolume.pseudoVolumes) {
                    labelIds.push(pseudoVolume.id);
                }
            }

            await logFile.writeLog(
                `Training results file found.\n\nCreating new checkpoint...\n`
            );

            const checkpoint = await Checkpoint.createFromFolder(
                userId,
                modelId,
                labelIds,
                outputPath,
                newBestModelPath
            );

            await logFile.writeLog(
                `New checkpoint created.\n\nSaving task history...\n`
            );

            await TaskHistory.update(taskHistoryId, {
                taskStatus: TaskHistory.status.finished,
                endTime: new Date(),
            });

            await logFile.writeLog(
                `Task history saved.\n\nTRAINING FINISHED!\n`
            );

            WebSocketManager.broadcastAction(
                [userId],
                [],
                ActionTypes.InsertCheckpoint,
                { checkpoint: checkpoint, modelId: modelId }
            );

            return checkpoint;
        } catch (error) {
            await logFile.writeLog(`ERROR: \n${error}`);
            console.error(`Nano Oetzi training error: ${error}`);
            try {
                await fsPromises.rm(workFolder, {
                    recursive: true,
                    force: true,
                });
            } catch (error) {
                console.error(
                    `Failed to remove temporary files after a failed Nano-Oetzi training:\n${error.message}`
                );
            }
            removeTempFiles = false;
            await TaskHistory.update(taskHistoryId, {
                taskStatus: TaskHistory.status.failed,
                endTime: new Date(),
            });
            throw error;
        } finally {
            if (this.config.nanoOetzi.cleanTemporaryFiles) {
                try {
                    await fsPromises.rm(workFolder, {
                        recursive: true,
                        force: true,
                    });
                } catch (error) {
                    console.error(
                        `Failed to remove temporary files after a failed Nano-Oetzi training:\n${error.message}`
                    );
                }
            }
        }
    }

    /**
     * @param {DeepVolume[]} trainingReferences
     * @param {DeepVolume[]} validationReferences
     * @param {DeepVolume[]} testReferences
     * @param {String} outputPath
     * @return {Promise<String>}
     */
    async #writeTrainingConfigFile(
        trainingReferences,
        validationReferences,
        testReferences,
        outputPath
    ) {
        const properties = {
            dimensions: null,
            channels: null,
        };
        const configData = {
            train: [],
            valid: [],
            test: [],
            properties: properties,
        };

        await this.#prepareTrainingConfigSet(
            trainingReferences,
            configData.train,
            properties
        );
        await this.#prepareTrainingConfigSet(
            validationReferences,
            configData.valid,
            properties
        );
        await this.#prepareTrainingConfigSet(
            testReferences,
            configData.test,
            properties
        );

        const configFilePath = path.join(outputPath, "trainingConfig.json");
        await fsPromises.writeFile(
            configFilePath,
            JSON.stringify(configData, null, 2),
            "utf-8"
        );
        return configFilePath;
    }

    /**
     * @param {DeepVolume[]} references
     * @param {Array} configDataArray
     * @param {{dimensions: Object?, channels:Number?}} properties
     */
    async #prepareTrainingConfigSet(references, configDataArray, properties) {
        for (const reference of references) {
            if (!reference.rawData) {
                throw new ApiError(
                    400,
                    "NanoOetzi inference error: One or more inputs are missing raw data."
                );
            }
            if (!reference.rawData.rawFilePath || !reference.rawData.settings) {
                throw new ApiError(
                    400,
                    "NanoOetzi inference error: One or more raw data volumes are missing either a raw file or settings."
                );
            }
            if (reference.pseudoVolumes.length == 0) {
                throw new ApiError(
                    400,
                    "NanoOetzi inference error: One or more inputs are missing raw data."
                );
            }

            const volumeSettings = JSON.parse(reference.rawData.settings);
            if (
                Object.hasOwn(volumeSettings, "usedBits") &&
                volumeSettings["usedBits"] != 8
            ) {
                throw new ApiError(
                    400,
                    "NanoOetzi inference error: One or more raw volume data inputs have an unsopported data format."
                );
            }

            if (properties.dimensions == null) {
                properties.dimensions = volumeSettings["size"];
            } else {
                GPUTaskHandler.#checkDimensions(
                    volumeSettings["size"],
                    properties.dimensions
                );
            }
            if (properties.channels == null) {
                properties.channels = reference.pseudoVolumes.length;
            } else {
                if (properties.channels != reference.pseudoVolumes.length) {
                    throw new ApiError(
                        400,
                        "NanoOetzi inference error: One or more inputs have missmatching number of pseudo labels."
                    );
                }
            }
            const volumeInput = {
                name: reference.name,
                rawDataPath: reference.rawData.rawFilePath,
                labels: [],
            };

            for (const pseudoVolume of reference.pseudoVolumes) {
                if (!pseudoVolume.rawFilePath || !pseudoVolume.settings) {
                    throw new ApiError(
                        400,
                        "NanoOetzi inference error: One or more pseudo labeled volumes are missing either a raw file or settings."
                    );
                }
                const pseudoVolumeSettings = JSON.parse(pseudoVolume.settings);
                if (
                    Object.hasOwn(pseudoVolumeSettings, "usedBits") &&
                    pseudoVolumeSettings["usedBits"] != 8
                ) {
                    throw new ApiError(
                        400,
                        "NanoOetzi inference error: One or more pseudo labeled volumes have an unsopported data format."
                    );
                }
                GPUTaskHandler.#checkDimensions(
                    pseudoVolumeSettings["size"],
                    properties.dimensions
                );
                volumeInput.labels.push(pseudoVolume.rawFilePath);
            }

            configDataArray.push(volumeInput);
        }
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
                "NanoOetzi inference error: One or more inputs have missmatching dimensions."
            );
        }
    }

    /**
     * @param {VolumeDB & {rawData: RawVolumeDataDB}} volume
     * @param {CheckpointDB} checkpoint
     */
    static #checkInferenceInput(volume, checkpoint) {
        if (!volume.rawData) {
            throw new ApiError(
                400,
                `Inference: Selected Volume must contain Raw Volume Data.`
            );
        }
        if (!volume.rawData.rawFilePath) {
            throw new ApiError(
                400,
                `Inference: Raw Volume Data Volume must contain a raw file.`
            );
        }
        if (!volume.rawData.settings) {
            throw new ApiError(
                400,
                `Inference: Raw Volume Data Volume must contain a settings file.`
            );
        }
        if (!fileSystem.existsSync(checkpoint.filePath)) {
            throw new ApiError(
                400,
                "Failed Attempt to start inference: Checkpoint file does not exist"
            );
        }
    }

    /**
     * @param {fileUpload.UploadedFile} tiltSeriesFile
     * @param {Object} options
     * @param {Number} volumeId
     * @param {Number} userId
     * @returns {Promise<void>}
     */
    async queueTiltSeriesReconstruction(
        tiltSeriesFile,
        options,
        volumeId,
        userId
    ) {
        if (this.#taskQueue.size >= this.config.gpuQueueSize) {
            throw new ApiError(
                400,
                "Failed Attempt to start tilt series reconstruction: Too many tasks in queue."
            );
        }

        const outputPath = this.createTemporaryOutputPath();

        const multiLock = new WriteMultiLock([
            Volume.lockManager.generateLockInstance(volumeId, [
                RawVolumeData.modelName,
            ]),
        ]);

        WriteMultiLock.withWriteMultiLock(multiLock, async () => {
            try {
                const taskHistory = await TaskHistory.create({
                    userId: userId,
                    volumeId: volumeId,
                    taskType: TaskHistory.type.Reconstruction,
                    taskStatus: TaskHistory.status.enqueued,
                    enqueuedTime: new Date(),
                });

                return await this.#taskQueue.enqueue(() =>
                    this.#runTiltSeriesReconstruction(
                        tiltSeriesFile,
                        options,
                        volumeId,
                        userId,
                        outputPath,
                        taskHistory.id
                    )
                );
            } catch (error) {
                console.error(
                    `Reconstruction task by User with id ${userId} failed.`
                );
            }
        });
    }

    /**
     * @param {fileUpload.UploadedFile} tiltSeriesFile
     * @param {Object | undefined} options
     * @param {Number} volumeId
     * @param {Number} userId
     * @param {String} outputPath
     * @param {Number} taskHistoryId
     * @returns {Promise<RawVolumeDataDB>}
     */
    async #runTiltSeriesReconstruction(
        tiltSeriesFile,
        options,
        volumeId,
        userId,
        outputPath,
        taskHistoryId
    ) {
        const logFile = await LogFile.createLogFile("reconstruction");

        try {
            await TaskHistory.update(taskHistoryId, {
                taskStatus: TaskHistory.status.running,
                startTime: new Date(),
                logFile: logFile.fileName,
            });

            fsPromises.mkdir(outputPath, { recursive: true });

            await logFile.writeLog("Tilt series reconstruction started\n");

            const inputFileAbsolutePath = path.resolve(
                tiltSeriesFile.tempFilePath
            );
            const inputFileName = Utils.stripExtension(tiltSeriesFile.name);

            const outputAbsolutePath = path.resolve(
                path.join(outputPath, inputFileName)
            );

            const params = [
                "filename",
                inputFileAbsolutePath,
                "result_filename",
                outputAbsolutePath,
            ];

            if (options) {
                for (const [key, value] of Object.entries(options)) {
                    params.push(key);
                    params.push(value.toString());
                }
            }

            // const command =
            //     "./" +
            //     this.config.Proximal_CryoET.executable +
            //     " " +
            //     params.join(" ");

            // const { stdout, stderr } = await execPromise(command, {
            //     cwd: path.resolve(this.config.Proximal_CryoET.path),
            // });

            // await logFile.writeLog(
            //     `stdout: \n${stdout}\n\nstderr: \n${stderr}\n--------------\nTilt series reconstruction finished\n\nConverting output to raw...\n`
            // );

            await Utils.runScript(
                "./" + this.config.Proximal_CryoET.executable,
                params,
                path.resolve(this.config.Proximal_CryoET.path),
                (value) => logFile.writeLog(value),
                (value) => logFile.writeLog(value)
            );

            await logFile.writeLog(
                `\n--------------\nTilt series reconstruction finished\n\nConverting output to raw...\n`
            );

            const { rawFileName, settings } = await Utils.analyzeToRaw(
                outputAbsolutePath + ".hdr",
                outputPath
            );

            const rawFilePath = path.join(outputPath, rawFileName);
            const settingsFilePath = path.join(outputPath, "settings.json");

            await fsPromises.writeFile(
                settingsFilePath,
                JSON.stringify(settings),
                "utf8"
            );

            const rawData = await RawVolumeData.createFromFiles(
                userId,
                volumeId,
                [
                    new PendingLocalFile(rawFilePath),
                    new PendingLocalFile(settingsFilePath),
                ],
                true
            );

            await logFile.writeLog(
                `Raw data created.\n\nSaving task history...\n`
            );

            await TaskHistory.update(taskHistoryId, {
                taskStatus: TaskHistory.status.finished,
                endTime: new Date(),
            });

            WebSocketManager.broadcastAction(
                [userId],
                [],
                ActionTypes.AddRawData,
                { volumeId: volumeId, rawData: rawData }
            );

            await logFile.writeLog(
                `Task history saved.\n\nRECONSTRUCTION FINISHED!\n`
            );

            return rawData;
        } catch (error) {
            await logFile.writeLog(`ERROR: \n${error}`);
            console.error(`Tilt series reconstruction error: ${error}`);
            await TaskHistory.update(taskHistoryId, {
                taskStatus: TaskHistory.status.failed,
                endTime: new Date(),
            });
            throw error;
        } finally {
            try {
                await fsPromises.rm(outputPath, {
                    recursive: true,
                    force: true,
                });
            } catch (error) {
                console.error(
                    `Filed to remove nano oetzi inference cache: ${error}`
                );
            }
            try {
                await fsPromises.rm(tiltSeriesFile.tempFilePath, {
                    force: true,
                });
            } catch {
                console.error(
                    "Inference: Failed to remove the temporary setting file."
                );
            }
        }
    }
}
