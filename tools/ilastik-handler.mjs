// @ts-check

import { exec } from "child_process";
import fileSystem from "fs";
import path from "path";
import fsPromises from "node:fs/promises";
import { labelsToH5, rawToH5 } from "./raw-to-h5.mjs";
import Utils from "./utils.mjs";
import { promisify } from "util";
import TaskQueue from "./task-queue.mjs";
const execPromise = promisify(exec);

/**
 * @typedef { import("@prisma/client").RawVolumeData } RawVolumeDataDB
 * @typedef { import("@prisma/client").SparseLabelVolumeData } SparseLabelVolumeDataDB
 */

export default class IlastikHandler {
    static rawDataset = "/raw_data";
    static labelsDataset = "/labels";
    static pseudoLabelsDataset = "/pseudo_labels";

    constructor(config) {
        this.config = config;
        this.taskQueue = new TaskQueue();

        Object.preventExtensions(this);
    }

    isInferenceRunning() {
        return this.taskQueue.hasPendingTask;
    }

    async getVersion() {
        const command = `${this.config.python} -c \"import ilastik; print ilastik.__version__\"`;
        const { stdout, stderr } = await execPromise(command);
        return stdout;
    }

    /**
     * @param {RawVolumeDataDB} rawData
     * @param {SparseLabelVolumeDataDB[]} sparseLabelsStack
     * @param {String?} outputPath
     * @returns {Promise<{outputPath: String, resultPath: String}>}
     */
    queueLabelGeneration(rawData, sparseLabelsStack, outputPath = null) {
        if (!rawData || !rawData.rawFilePath) {
            throw new Error(
                "Failed Attempt to queue label generation: Raw Data is missing."
            );
        }
        if (!sparseLabelsStack || sparseLabelsStack.length === 0) {
            throw new Error(
                "Failed Attempt to queue label generation: Sparse Label Data is missing."
            );
        }
        if (this.taskQueue.size >= this.config.maxQueueSize) {
            throw new Error(
                "Failed Attempt to queue label generation: Too many tasks in queue."
            );
        }

        if (!outputPath) {
            outputPath = Utils.createTemporaryFolder(this.config.workCache);
        }
        return this.taskQueue.enqueue(() =>
            this.#generateLabels(rawData, sparseLabelsStack, outputPath)
        );
    }

    /**
     * @param {String} rawDataPath
     * @param {String} modelPath
     * @param {String} labelsOutputPath
     * @param {String} logPath
     * @returns {Promise<String>}
     */
    async #runIlastikInference(
        rawDataPath,
        modelPath,
        labelsOutputPath,
        logPath
    ) {
        console.log("Running Ilastik inference");

        await fsPromises.writeFile(logPath, "\n\nIlastik inference started\n");

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
        console.log(command);

        const { stdout, stderr } = await execPromise(command);
        await fsPromises.writeFile(
            logPath,
            `stdout: \n${stdout}\nstderr: \n${stderr}`
        );

        return resultsFilePath;
    }

    /**
     * @param {String} rawDataPath
     * @param {String} sparseLabelPath
     * @param {String} outputPath
     * @param {String} logPath
     * @returns {Promise<String>}
     */
    async #createIlastikProject(
        rawDataPath,
        sparseLabelPath,
        outputPath,
        logPath
    ) {
        await fsPromises.writeFile(logPath, "\n\nCreating Ilastik project\n");

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
        console.log(command);
        const { stdout, stderr } = await execPromise(command);
        await fsPromises.writeFile(
            logPath,
            `stdout: \n${stdout}\nstderr: \n${stderr}`
        );

        return modelOutputFullPath;
    }

    /**
     * @param {RawVolumeDataDB} rawData
     * @param {SparseLabelVolumeDataDB[]} sparseLabelsStack
     * @param {String} outputPath
     * @returns {Promise<{outputPath: String, resultPath: String}>}
     */
    async #generateLabels(rawData, sparseLabelsStack, outputPath) {
        const logPath = path.join(outputPath, "!label-generation.log");
        try {
            await fsPromises.writeFile(
                logPath,
                "Stating label generation process\n\n"
            );

            if (!rawData || !rawData.rawFilePath) {
                throw new Error(
                    "Pseudo Labels Generation error: Raw Data is missing."
                );
            }
            if (!sparseLabelsStack || sparseLabelsStack.length === 0) {
                throw new Error(
                    "Pseudo Labels Generation error: Sparse Label Data is missing."
                );
            }

            const settings = JSON.parse(rawData.settings);
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
            for (const sparseLabel of sparseLabelsStack) {
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

            const rawH5FileName = path.parse(rawData.rawFilePath).name + ".h5";
            const labelsH5FileName =
                path.parse(rawData.rawFilePath).name + "_labels.h5";

            const rawH5Path = path.join(
                outputPath,
                rawH5FileName
            );
            const labelsH5Path = path.join(
                outputPath,
                labelsH5FileName
            );

            await fsPromises.writeFile(
                logPath,
                "Converting raw data to HDF5 format...\n"
            );
            await this.#convertDataToH5(
                rawData,
                sparseLabelsStack,
                dimensions,
                rawH5Path,
                labelsH5Path
            );
            await fsPromises.writeFile(
                logPath,
                "Data conversion to HDF5 complete."
            );

            const modelFullPath = await this.#createIlastikProject(
                rawH5Path,
                labelsH5Path,
                outputPath,
                logPath
            );

            const resultPath = await this.#runIlastikInference(
                rawH5Path,
                modelFullPath,
                outputPath,
                logPath
            );

            return { outputPath: outputPath, resultPath: resultPath };
        } catch (error) {
            console.log(`exec error: ${error}`);
            fileSystem.appendFileSync(logPath, `exec error: ${error}`);
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
            throw error;
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
}
