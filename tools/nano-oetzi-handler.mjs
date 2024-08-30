// @ts-check

import path from "path";
import fileSystem from "fs";
import { promisify } from "node:util";
import { exec } from "child_process";
const execPromise = promisify(exec);
import { TaskQueue } from "./task-queue.mjs";
import { getInverseDateString } from "./utils.mjs";
import fsPromises from "node:fs/promises";

/**
 * @typedef { import("@prisma/client").RawVolumeData } RawVolumeDataDB
 * @typedef { import("@prisma/client").PseudoLabelVolumeData } PseudoVolumeDataDB
 * @typedef { import("@prisma/client").Volume } VolumeDB
 * @typedef { Object } DeepVolumeProperties
 * @property { RawVolumeDataDB } rawData
 * @property { PseudoVolumeDataDB[] } pseudoVolumes
 * @typedef { VolumeDB & DeepVolumeProperties } DeepVolume
 */

export class NanoOetziHandler {
    constructor(config) {
        this.config = config;
        this.taskQueue = new TaskQueue();

        Object.preventExtensions(this);
    }

    isInferenceRunning() {
        return this.taskQueue.hasPendingTask;
    }

    createTemporaryOutputPath() {
        let tempFolderPath = path.join(
            this.config.workCache,
            getInverseDateString()
        );
        while (fileSystem.existsSync(tempFolderPath)) {
            tempFolderPath += "_";
        }
        fileSystem.mkdirSync(tempFolderPath, { recursive: true });
        return tempFolderPath;
    }

    /**
     * @param {String} inferenceDataPath
     * @param {String} checkpointFilename
     * @param {String?} outputPath
     * @returns {Promise<String>}
     */
    queueInference(inferenceDataPath, checkpointFilename, outputPath = null) {
        if (!inferenceDataPath) {
            throw new Error(
                "Failed Attempt to start inference: Missing inference data path."
            );
        }
        if (!checkpointFilename) {
            throw new Error(
                "Failed Attempt to start inference: Missing checkpoint data path."
            );
        }
        if (this.taskQueue.size >= this.config.maxQueueSize) {
            throw new Error(
                "Failed Attempt to start inference: Too many tasks in queue."
            );
        }

        if (!outputPath) {
            outputPath = this.createTemporaryOutputPath();
        }
        return this.taskQueue.enqueue(() =>
            this.#runInference(
                inferenceDataPath,
                checkpointFilename,
                outputPath
            )
        );
    }

    /**
     * @param {String} inferenceDataPath
     * @param {String} checkpointFilename
     * @param {String} outputPath
     * @returns {Promise<String>}
     */
    async #runInference(inferenceDataPath, checkpointFilename, outputPath) {
        const logPath = path.join(outputPath, "!inference.log");

        try {
            if (!fileSystem.existsSync(inferenceDataPath)) {
                throw new Error(
                    "Failed Attempt to start inference: Inference data does not exist"
                );
            }
            if (!fileSystem.existsSync(checkpointFilename)) {
                throw new Error(
                    "Failed Attempt to start inference: Checkpoint file does not exist"
                );
            }
            if (!fileSystem.existsSync(outputPath)) {
                fileSystem.mkdirSync(outputPath, { recursive: true });
            }

            await fsPromises.writeFile(
                logPath,
                "Nano-Oetzi inference started\n--------------\n"
            );

            let inferenceDataAbsolutePath = path.resolve(inferenceDataPath);
            let outputAbsolutePath = path.resolve(outputPath);

            if (!fileSystem.existsSync(outputAbsolutePath)) {
                fileSystem.mkdirSync(outputAbsolutePath, { recursive: true });
            }

            let checkpointAbsolutePath = path.resolve(checkpointFilename);
            let params = [
                "./" + this.config.inference.command,
                inferenceDataAbsolutePath + " " + outputAbsolutePath + " ",
                "-m " + checkpointAbsolutePath,
            ];
            let command =
                this.config.command +
                " " +
                params[0] +
                " " +
                params[1] +
                " " +
                params[2];
            console.log(command);

            const { stdout, stderr } = await execPromise(command, {
                cwd: path.resolve(this.config.scripts),
            });
            await fsPromises.appendFile(
                logPath,
                `\nstdout: \n${stdout}\n\nstderr: \n${stderr}\n--------------\nNanoOetzi inference finished`
            );
            console.log("NanoOetzi inference finished");
            return outputPath;
        } catch (error) {
            await fsPromises.appendFile(logPath, `\nERROR: \n${error}`);
            console.error(`NanoOetzi inference error: ${error}`);
            await fsPromises.rm(outputPath, { recursive: true, force: true });
            throw error;
        }
    }

    /**
     * @param {DeepVolume[]} trainingReferences
     * @param {DeepVolume[]} validationReferences
     * @param {DeepVolume[]} testReferences
     * @param {String?} outputPath
     * @param {boolean} removeTempFiles
     * @returns {Promise<{outputPath: string, checkpointPath:string}>}
     */
    queueTraining(
        trainingReferences,
        validationReferences,
        testReferences,
        outputPath = null,
        removeTempFiles = true
    ) {
        if (!trainingReferences || trainingReferences.length == 0) {
            throw new Error(
                "Failed Attempt to start training: Missing training data."
            );
        }
        if (!validationReferences || validationReferences.length == 0) {
            throw new Error(
                "Failed Attempt to start training: Missing validation data."
            );
        }
        if (!testReferences || testReferences.length == 0) {
            throw new Error(
                "Failed Attempt to start training: Missing test data."
            );
        }
        if (this.taskQueue.size >= this.config.maxQueueSize) {
            throw new Error(
                "Failed Attempt to start inference: Too many tasks in queue."
            );
        }

        if (!outputPath) {
            outputPath = this.createTemporaryOutputPath();
        }
        return this.taskQueue.enqueue(() =>
            this.#runTraining(
                trainingReferences,
                validationReferences,
                testReferences,
                outputPath,
                removeTempFiles
            )
        );
    }

    /**
     * @param {DeepVolume[]} trainingReferences
     * @param {DeepVolume[]} validationReferences
     * @param {DeepVolume[]} testReferences
     * @param {String} outputPath
     * @param {boolean} removeTempFiles
     * @returns {Promise<{outputPath: string, checkpointPath:string}>}
     */
    async #runTraining(
        trainingReferences,
        validationReferences,
        testReferences,
        outputPath,
        removeTempFiles = true
    ) {
        const logPath = path.join(outputPath, "!training.log");
        const workFolder = path.join(outputPath, "training-data");

        try {
            await fsPromises.writeFile(
                logPath,
                "Nano-Oetzi training started\n--------------\n"
            );

            await fsPromises.mkdir(workFolder, { recursive: true });

            await fsPromises.appendFile(
                logPath,
                `Creating training configuration file...\n`
            );

            const configPath = await this.#writeTrainingConfigFile(
                trainingReferences,
                validationReferences,
                testReferences,
                workFolder
            );

            await fsPromises.appendFile(
                logPath,
                `Training configuration file created successfully.\n`
            );

            const configAbsolutePath = path.resolve(configPath);
            const outputAbsolutePath = path.resolve(workFolder);

            let command = `${this.config.command} \"${path.join(
                "tools-python",
                "raws-to-train-sets.py"
            )}\" -i \"${configAbsolutePath}\" -o \"${outputAbsolutePath}\"`;

            await fsPromises.appendFile(
                logPath,
                "Converting raw data into pytorch tensors...\n"
            );

            let execResult = await execPromise(command);

            await fsPromises.appendFile(
                logPath,
                `Success.\nstdout: \n${execResult.stdout}\nstderr: \n${execResult.stderr}\n\nLauching training script...\n`
            );

            command = `${this.config.command} \"${this.config.training.command}\" \"${outputAbsolutePath}\" --min_epochs ${this.config.training.min_epochs} --max_epochs ${this.config.training.max_epochs}`;

            execResult = await execPromise(command, {
                cwd: path.resolve(this.config.scripts),
            });

            await fsPromises.appendFile(
                logPath,
                `Success.\nstdout: \n${execResult.stdout}\nstderr: \n${execResult.stderr}\n\nSearching for training results file...`
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

            return { outputPath: outputPath, checkpointPath: newBestModelPath };
        } catch (error) {
            await fsPromises.appendFile(logPath, `\nERROR: \n${error}`);
            console.log(`NanoOetzi inference error: ${error}`);
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
            throw error;
        } finally {
            if (removeTempFiles) {
                await fsPromises.rm(workFolder, {
                    recursive: true,
                    force: true,
                });
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
                this.#checkDimensions(
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
                this.#checkDimensions(
                    pseudoVolumeSettings["size"],
                    properties.dimensions
                );
                volumeInput.labels.push(pseudoVolume.rawFilePath);
            }

            configDataArray.push(volumeInput);
        }
    }

    #checkDimensions(dim1, dim2) {
        if (
            dim1["x"] != dim2["x"] ||
            dim1["y"] != dim2["y"] ||
            dim1["z"] != dim2["z"]
        ) {
            throw new Error(
                "NanoOetzi inference error: One or more inputs have missmatching dimensions."
            );
        }
    }
}
