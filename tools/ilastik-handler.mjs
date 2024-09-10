// @ts-check

import { exec, spawnSync } from "child_process";
import fileSystem from "fs";
import path from "path";
import { StoredFolder } from "./stored-folder.mjs";
import fsPromises from "node:fs/promises";
import { labelsToH5, rawToH5 } from "./raw-to-h5.mjs";
import Utils from "./utils.mjs";
import { promisify } from "util";
const execPromise = promisify(exec);

/**
 * @typedef { import("@prisma/client").RawVolumeData } RawVolumeDataDB
 * @typedef { import("@prisma/client").SparseLabelVolumeData } SparseLabelVolumeDataDB
 */

export default class IlastikHandler {
    static rawCacheFolder = "raw";
    static labelsCacheFolder = "sparse-labels";
    static rawDataset = "/raw_data";
    static labelsDataset = "/labels";

    constructor(config) {
        this.config = config;
        this.inferenceRunning = false;
        this.finished = false;
    }

    getVersion() {
        let result = spawnSync(this.config.python, [
            "-c",
            "import ilastik; print ilastik.__version__",
        ]);
        return result.stdout;
        // return result.stdout.toString().split('\n')[0];
    }

    /*
./python ./train_headless.py /home/bohakc/crop/ts_16_crop_test_project.ilp "/home/bohakc/crop/input/*.tif" "/home/bohakc/crop/labels/*.tiff"

./run_ilastik.sh --headless --project=/home/bohakc/crop/ts_16_crop_test_project.ilp --output_format="tif sequence" --export_source="Probabilities" --export_dtype=uint8 --pipeline_result_drange="(0.0,1.0)" --export_drange="(0,255)" --output_filename_format=/home/bohakc/crop/ts_16_crop_output/{nickname}_{slice_index}_results.tiff "/home/bohakc/crop/input/*.tif"

../ilastik/run_ilastik.sh --headless --project=/home/bohakc/volWeb/models/2-Ilastik_test/model_project.ilp --output_format="tif sequence" --export_source="Probabilities" --export_dtype=uint8 --pipeline_result_drange="(0.0,1.0)" --export_drange="(0,255)" --output_filename_format=/home/bohakc/volWeb/models/2-Ilastik_test/ilastik-labels/tif/{nickname}_{slice_index}_results.tif /home/bohakc/volWeb/models/2-Ilastik_test/raw-data/tif/*.tif
*/
    /**
     * @param {String} rawDataPath
     * @param {String} modelPath
     * @param {String} labelsOutputPath
     */
    async runIlastikInference(rawDataPath, modelPath, labelsOutputPath) {
        console.log("Running Ilastik inference");
        this.inferenceRunning = true;

        const logPath = path.join(labelsOutputPath, "!inference.log");
        fileSystem.writeFileSync(logPath, "Ilastik inference started\n\n");

        const ilastikLabels = new StoredFolder(
            path.basename(labelsOutputPath),
            labelsOutputPath
        );
        const rawDataFullPath =
            path.resolve(rawDataPath) + IlastikHandler.rawDataset;
        const modelFullPath = path.resolve(modelPath);
        const resultsFilePath = path.join(
            ilastikLabels.folderPath,
            `${path.parse(rawDataPath).name}_results.h5`
        );

        let params = [
            "--headless",
            `--project=\"${modelFullPath}\"`,
            '--output_format="hdf5"',
            '--export_source="Probabilities"',
            "--export_dtype=uint8",
            '--pipeline_result_drange="(0.0,1.0)"',
            '--export_drange="(0,255)"',
            `--output_filename_format=\"${resultsFilePath}\"`,
            '"' + rawDataFullPath + '"',
        ];
        const command =
            this.config.path + this.config.inference + " " + params.join(" ");
        console.log(command);

        if (!fileSystem.existsSync(ilastikLabels.folderPath)) {
            fileSystem.mkdirSync(ilastikLabels.folderPath, { recursive: true });
        }

        try {
            const { stdout, stderr } = await execPromise(command);
            fileSystem.appendFileSync(logPath, `\n\nstdout: \n${stdout}`);
            fileSystem.appendFileSync(logPath, `\n\nstderr: \n${stderr}`);
            console.log("Ilastik inference finished");

            Promise.resolve(ilastikLabels);
            console.log("Ilastik labels successfully generated.");
            return resultsFilePath;
        } catch (error) {
            console.log(`exec error: ${error}`);
            fileSystem.appendFileSync(logPath, `\n\nexec error: ${error}`);
            throw error;
        } finally {
            this.inferenceRunning = false;
            this.finished = true;
        }
    }

    /**
     * @param {String} rawDataPath
     * @param {String} sparseLabelPath
     * @param {String} modelOutputPath
     * @param {String} labelsOutputPath
     */
    async createIlastikProject(
        rawDataPath,
        sparseLabelPath,
        modelOutputPath,
        labelsOutputPath
    ) {
        console.log("Creating Ilastik project");
        const logPath = path.join(labelsOutputPath, "!projectCreation.log");
        fileSystem.writeFileSync(logPath, "Creating Ilastik project\n\n");

        this.finished = false;
        const modelOutputFullPath = path.join(
            path.resolve(modelOutputPath),
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

        try {
            const { stdout, stderr } = await execPromise(command);
            fileSystem.appendFileSync(logPath, `\n\nstdout: \n${stdout}`);
            fileSystem.appendFileSync(logPath, `\n\nstderr: \n${stderr}`);
            console.log("Ilastik project created");

            return modelOutputFullPath;
        } catch (error) {
            this.finished = false;
            console.log(`exec error: ${error}`);
            fileSystem.appendFileSync(logPath, `\n\nexec error: ${error}`);
            throw error;
        }
    }

    isInferenceRunning() {
        return this.inferenceRunning;
    }

    isFinished() {
        return this.finished;
    }

    /**
     * @param {RawVolumeDataDB} rawData
     * @param {SparseLabelVolumeDataDB[]} sparseLabelsStack
     * @param {String} modelOutputPath
     * @param {String} labelsOutputPath
     */
    async generateLabels(
        rawData,
        sparseLabelsStack,
        modelOutputPath,
        labelsOutputPath
    ) {
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
            this.config.h5CacheFolder,
            IlastikHandler.rawCacheFolder,
            rawH5FileName
        );
        const labelsH5Path = path.join(
            this.config.h5CacheFolder,
            IlastikHandler.labelsCacheFolder,
            labelsH5FileName
        );

        await this.convertDataToH5(
            rawData,
            sparseLabelsStack,
            dimensions,
            rawH5Path,
            labelsH5Path
        );

        const modelFullPath = await this.createIlastikProject(
            rawH5Path,
            labelsH5Path,
            modelOutputPath,
            labelsOutputPath
        );

        await this.runIlastikInference(
            rawH5Path,
            modelFullPath,
            labelsOutputPath
        );
    }

    /**
     * @param {RawVolumeDataDB} rawData
     * @param {SparseLabelVolumeDataDB[]} sparseLabelsStack
     * @param {{x: Number, y: Number, z: Number}} dimensions
     * @param {String} rawOutputPath
     * @param {String} labelsOutputPath
     */
    async convertDataToH5(
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

        await rawToH5(rawData.rawFilePath, dimensions, rawOutputPath);
        await labelsToH5(
            sparseLabelsStack.map((l) => l.rawFilePath),
            dimensions,
            labelsOutputPath
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
