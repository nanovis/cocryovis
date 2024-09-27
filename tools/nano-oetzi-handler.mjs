// @ts-check

import path from "path";
import fileSystem from "fs";
import { promisify } from "node:util";
import { exec } from "child_process";
const execPromise = promisify(exec);
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

/**
 * @typedef { import("@prisma/client").RawVolumeData } RawVolumeDataDB
 * @typedef { import("@prisma/client").PseudoLabelVolumeData } PseudoVolumeDataDB
 * @typedef { import("@prisma/client").Volume } VolumeDB
 * @typedef { import("@prisma/client").Result } ResultDB
 * @typedef { import("@prisma/client").Checkpoint } CheckpointDB
 * @typedef { VolumeDB & {rawData: RawVolumeDataDB, pseudoVolumes: PseudoVolumeDataDB[]} } DeepVolume
 */

class TaskProperties {
    /** @type {Number} */ userId;
    /** @type {String} */ type;

    static type = {
        inference: "inference",
        training: "training",
    };

    /**
     * @param {Number} userId
     * @param {String} type
     */
    constructor(userId, type) {
        this.userId = userId;
        this.type = type;
    }
}

export class InferenceTaskProperties extends TaskProperties {
    /** @type {Number} */ checkpointId;
    /** @type {Number} */ volumeId;

    /**
     * @param {Number} userId
     * @param {String} type
     * @param {Number} checkpointId
     * @param {Number} volumeId
     */
    constructor(userId, type, checkpointId, volumeId) {
        super(userId, type);
        this.checkpointId = checkpointId;
        this.volumeId = volumeId;

        Object.preventExtensions(this);
    }
}

export class TrainingTaskProperties extends TaskProperties {
    /** @type {Number} */ modelId;
    /** @type {Number[]} */ trainingVolumesIds;
    /** @type {Number[]} */ validationVolumesIds;
    /** @type {Number[]} */ testingVolumesIds;

    /**
     * @param {Number} userId
     * @param {String} type
     * @param {Number} modelId
     * @param {Number[]} trainingVolumesIds
     * @param {Number[]} validationVolumesIds
     * @param {Number[]} testingVolumesIds
     */
    constructor(
        userId,
        type,
        modelId,
        trainingVolumesIds,
        validationVolumesIds,
        testingVolumesIds
    ) {
        super(userId, type);
        this.modelId = modelId;
        this.trainingVolumesIds = trainingVolumesIds;
        this.validationVolumesIds = validationVolumesIds;
        this.testingVolumesIds = testingVolumesIds;

        Object.preventExtensions(this);
    }
}

class TaskHistory {
    static status = {
        success: "success",
        fail: "fail",
    };

    /**
     * @param {String} taskStatus
     * @param {LogFile} logFile
     * @param {TaskProperties} taskProperties
     */
    constructor(taskStatus, logFile, taskProperties) {
        this.taskProperties = taskProperties;
        this.taskStatus = taskStatus;
        this.logFile = logFile;

        Object.preventExtensions(this);
    }
}

export default class NanoOetziHandler {
    /** @type {TaskQueue} */ #taskQueue;
    /** @type {TaskHistory[]} */ taskHistory = [];

    constructor(config) {
        this.config = config;
        this.#taskQueue = new TaskQueue();

        Object.preventExtensions(this);
    }

    isInferenceRunning() {
        return this.#taskQueue.hasPendingTask;
    }

    /**
     * @returns {TaskProperties[]}
     */
    get queuedIdentifiers() {
        return this.#taskQueue.queuedIdentifiers;
    }

    createTemporaryOutputPath() {
        let tempFolderPath = path.join(
            this.config.workCache,
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
        if (this.#taskQueue.size >= this.config.maxQueueSize) {
            throw new Error(
                "Failed Attempt to start inference: Too many tasks in queue."
            );
        }

        const volume = await Volume.getByIdDeep(volumeId, { rawData: true });
        const checkpoint = await Checkpoint.getById(checkpointId);

        NanoOetziHandler.#checkInferenceInput(volume, checkpoint);

        if (!outputPath) {
            outputPath = this.createTemporaryOutputPath();
        }

        const multiLock = new WriteMultiLock([
            Checkpoint.lockManager.generateLockInstance(checkpointId),
            Volume.lockManager.generateLockInstance(volumeId, [
                RawVolumeData.modelName,
            ]),
            User.lockManager.generateLockInstance(userId),
        ]);

        WriteMultiLock.withWriteMultiLock(multiLock, () => {
            return this.#taskQueue.enqueue(
                () =>
                    this.#runInference(
                        checkpointId,
                        volumeId,
                        userId,
                        outputPath
                    ),
                new InferenceTaskProperties(
                    userId,
                    TaskProperties.type.inference,
                    checkpointId,
                    volumeId
                )
            );
        });
    }

    /**
     * @param {Number} checkpointId
     * @param {Number} volumeId
     * @param {Number} userId
     * @param {String} outputPath
     * @returns {Promise<ResultDB>}
     */
    async #runInference(checkpointId, volumeId, userId, outputPath) {
        const logFile = await LogFile.createLogFile("inference");
        let tempSettingsPath = null;
        const taskProperties = new InferenceTaskProperties(
            userId,
            TaskProperties.type.inference,
            checkpointId,
            volumeId
        );

        try {
            const volume = await Volume.getByIdDeep(volumeId, {
                rawData: true,
            });
            const checkpoint = await Checkpoint.getById(checkpointId);

            NanoOetziHandler.#checkInferenceInput(volume, checkpoint);

            tempSettingsPath = path.join(volume.rawData.path, "settings.json");
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
                "./" + this.config.inference.command,
                inferenceDataAbsolutePath,
                outputAbsolutePath,
                "-m " + checkpointAbsolutePath,
            ];
            if (this.config.inference.cleanTemporaryFiles) {
                params.push("-c True");
            }
            const command = this.config.python + " " + params.join(" ");

            const { stdout, stderr } = await execPromise(command, {
                cwd: path.resolve(this.config.scripts),
            });
            await logFile.writeLog(
                `stdout: \n${stdout}\n\nstderr: \n${stderr}\n--------------\nNanoOetzi inference finished\n\nCreating results entry...\n`
            );

            const result = await Result.createFromFolder(
                userId,
                checkpointId,
                volume.rawData.id,
                volumeId,
                outputPath
            );

            await logFile.writeLog(
                `Result entry created.\n\nSaving task history...\n`
            );

            this.taskHistory.push(
                new TaskHistory(
                    TaskHistory.status.success,
                    logFile,
                    taskProperties
                )
            );

            await logFile.writeLog(
                `Task history saved.\n\nINFERENCE FINISHED!\n`
            );

            return result;
        } catch (error) {
            await logFile.writeLog(`ERROR: \n${error}`);
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
            this.taskHistory.push(
                new TaskHistory(
                    TaskHistory.status.fail,
                    logFile,
                    taskProperties
                )
            );
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
            throw new Error(
                "Failed Attempt to start training: Missing training data."
            );
        }
        if (!validationVolumesIds || validationVolumesIds.length == 0) {
            throw new Error(
                "Failed Attempt to start training: Missing validation data."
            );
        }
        if (!testingVolumesIds || testingVolumesIds.length == 0) {
            throw new Error(
                "Failed Attempt to start training: Missing test data."
            );
        }
        if (this.#taskQueue.size >= this.config.maxQueueSize) {
            throw new Error(
                "Failed Attempt to start inference: Too many tasks in queue."
            );
        }

        if (!outputPath) {
            outputPath = this.createTemporaryOutputPath();
        }

        const modelLock = Model.lockManager.generateLockInstance(modelId, [
            Checkpoint.modelName,
        ]);
        const userLock = User.lockManager.generateLockInstance(userId);

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

        const multiLock = new WriteMultiLock([
            modelLock,
            userLock,
            ...volumeLocks,
        ]);

        WriteMultiLock.withWriteMultiLock(multiLock, () => {
            return this.#taskQueue.enqueue(
                () =>
                    this.#runTraining(
                        modelId,
                        userId,
                        trainingVolumesIds,
                        validationVolumesIds,
                        testingVolumesIds,
                        outputPath,
                        removeTempFiles
                    ),
                new TrainingTaskProperties(
                    userId,
                    TaskProperties.type.training,
                    modelId,
                    trainingVolumesIds,
                    validationVolumesIds,
                    testingVolumesIds
                )
            );
        });
    }

    /**
     * @param {Number} modelId
     * @param {Number} userId
     * @param {Number[]} trainingVolumesIds
     * @param {Number[]} validationVolumesIds
     * @param {Number[]} testingVolumesIds
     * @param {String} outputPath
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
        removeTempFiles = true
    ) {
        const logFile = await LogFile.createLogFile("training");
        const workFolder = path.join(outputPath, "training-data");
        const taskProperties = new TrainingTaskProperties(
            userId,
            TaskProperties.type.training,
            modelId,
            trainingVolumesIds,
            validationVolumesIds,
            testingVolumesIds
        );

        try {
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

            let command = `${this.config.python} \"${path.join(
                "tools-python",
                "raws-to-train-sets.py"
            )}\" -i \"${configAbsolutePath}\" -o \"${outputAbsolutePath}\"`;

            await logFile.writeLog(
                "Converting raw data into pytorch tensors...\n"
            );

            let execResult = await execPromise(command);

            await logFile.writeLog(
                `Success.\nstdout: \n${execResult.stdout}\nstderr: \n${execResult.stderr}\n\nLauching training script...\n`
            );

            command = `${this.config.python} \"${this.config.training.command}\" \"${outputAbsolutePath}\" --min_epochs ${this.config.training.min_epochs} --max_epochs ${this.config.training.max_epochs}`;

            execResult = await execPromise(command, {
                cwd: path.resolve(this.config.scripts),
            });

            await logFile.writeLog(
                `Success.\nstdout: \n${execResult.stdout}\nstderr: \n${execResult.stderr}\n\nSearching for training results file...\n`
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

            this.taskHistory.push(
                new TaskHistory(
                    TaskHistory.status.success,
                    logFile,
                    taskProperties
                )
            );

            await logFile.writeLog(
                `Task history saved.\n\nTRAINING FINISHED!\n`
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
            this.taskHistory.push(
                new TaskHistory(
                    TaskHistory.status.fail,
                    logFile,
                    taskProperties
                )
            );
            throw error;
        } finally {
            if (removeTempFiles) {
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
                throw new Error(
                    "NanoOetzi inference error: One or more inputs are missing raw data."
                );
            }
            if (!reference.rawData.rawFilePath || !reference.rawData.settings) {
                throw new Error(
                    "NanoOetzi inference error: One or more raw data volumes are missing either a raw file or settings."
                );
            }
            if (reference.pseudoVolumes.length == 0) {
                throw new Error(
                    "NanoOetzi inference error: One or more inputs are missing raw data."
                );
            }

            const volumeSettings = JSON.parse(reference.rawData.settings);
            if (
                Object.hasOwn(volumeSettings, "usedBits") &&
                volumeSettings["usedBits"] != 8
            ) {
                throw new Error(
                    "NanoOetzi inference error: One or more raw volume data inputs have an unsopported data format."
                );
            }

            if (properties.dimensions == null) {
                properties.dimensions = volumeSettings["size"];
            } else {
                NanoOetziHandler.#checkDimensions(
                    volumeSettings["size"],
                    properties.dimensions
                );
            }
            if (properties.channels == null) {
                properties.channels = reference.pseudoVolumes.length;
            } else {
                if (properties.channels != reference.pseudoVolumes.length) {
                    throw new Error(
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
                    throw new Error(
                        "NanoOetzi inference error: One or more pseudo labeled volumes are missing either a raw file or settings."
                    );
                }
                const pseudoVolumeSettings = JSON.parse(pseudoVolume.settings);
                if (
                    Object.hasOwn(pseudoVolumeSettings, "usedBits") &&
                    pseudoVolumeSettings["usedBits"] != 8
                ) {
                    throw new Error(
                        "NanoOetzi inference error: One or more pseudo labeled volumes have an unsopported data format."
                    );
                }
                NanoOetziHandler.#checkDimensions(
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
            throw new Error(
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
            throw new Error(
                `Inference: Selected Volume must contain Raw Volume Data.`
            );
        }
        if (!volume.rawData.rawFilePath) {
            throw new Error(
                `Inference: Raw Volume Data Volume must contain a raw file.`
            );
        }
        if (!volume.rawData.settings) {
            throw new Error(
                `Inference: Raw Volume Data Volume must contain a settings file.`
            );
        }
        if (!fileSystem.existsSync(checkpoint.filePath)) {
            throw new Error(
                "Failed Attempt to start inference: Checkpoint file does not exist"
            );
        }
    }
}
