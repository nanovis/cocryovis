// @ts-check

import fileSystem from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { exec, spawn } from "child_process";
import appConfig from "./config.mjs";
import { promisify } from "node:util";
import fs from "fs";
const execPromise = promisify(exec);

export default class Utils {
    /**
     * @param {String} name
     */
    static fileNameFilter(name) {
        return name.replace(/\s+/g, "_").replace(/[^\da-zA-Z_.-]+/g, "");
    }

    /**
     * @param {String} filename
     * @param {String[]} acceptedFileExtensions
     */
    static isFileExtensionAccepted(filename, acceptedFileExtensions) {
        return (
            acceptedFileExtensions.length === 0 ||
            acceptedFileExtensions.some((extension) =>
                filename.endsWith(extension)
            )
        );
    }

    /**
     * @param {String} fileName
     * @returns {String}
     */
    static stripExtension(fileName) {
        return path.parse(fileName).name;
    }

    /**
     * @param {String} inputFile
     * @param {String} outputPath
     */
    static async mrcToRaw(inputFile, outputPath) {
        const command = `${appConfig.nanoOetzi.python} \"${path.join(
            "src",
            "tools-python",
            "mrc-to-raw.py"
        )}\" -i \"${inputFile}\" -o \"${outputPath}\"`;
        const { stdout, stderr } = await execPromise(command);
        // fs.writeFileSync(
        //     path.join(outputPath, "mrc-to-raw.log"),
        //     `Converting mrc file to a raw file\n\nstdout:\n${stdout}\n\stderr:\n${stderr}`
        // );
        const data = JSON.parse(stdout);
        return {
            rawFileName: data["file"],
            settings: data,
        };
    }

    /**
     * @param {String} inputFile
     * @param {String} outputPath
     */
    static async analyzeToRaw(inputFile, outputPath) {
        const command = `${appConfig.nanoOetzi.python} \"${path.join(
            "src",
            "tools-python",
            "analyze-to-raw.py"
        )}\" -i \"${inputFile}\" -o \"${outputPath}\"`;
        const { stdout, stderr } = await execPromise(command);
        // fs.writeFileSync(
        //     path.join(outputPath, "analyze-to-raw.log"),
        //     `Converting mrc file to a raw file\n\nstdout:\n${stdout}\n\stderr:\n${stderr}`
        // );
        const data = JSON.parse(stdout);
        return {
            rawFileName: data["file"],
            settings: data,
        };
    }

    static getInverseDateString(date = new Date()) {
        return (
            date.getUTCFullYear() +
            "-" +
            ("0" + (date.getUTCMonth() + 1)).slice(-2) +
            "-" +
            ("0" + date.getUTCDate()).slice(-2) +
            "_" +
            ("0" + date.getUTCHours()).slice(-2) +
            "-" +
            ("0" + date.getUTCMinutes()).slice(-2) +
            "-" +
            ("0" + date.getUTCSeconds()).slice(-2) +
            "-" +
            ("0" + date.getUTCMilliseconds()).slice(-3)
        );
    }

    /**
     * @param {String} filePath
     */
    static generateUniqueFileName(filePath) {
        const folder = path.dirname(filePath);
        const fileName = Utils.stripExtension(filePath);
        const extension = path.extname(filePath);
        let counter = 1;

        while (fs.existsSync(filePath)) {
            filePath = path.join(folder, `${fileName}-${counter}${extension}`);
            counter++;
        }

        return path.basename(filePath);
    }

    /**
     * @param {String[]} array
     */
    static parseStringArray(array) {
        if (!Array.isArray(array)) {
            array = [array];
        }

        return array.map((s) => Number(s));
    }

    /**
     * @param {String} basePath
     * @returns {String}
     */
    static createTemporaryFolder(basePath) {
        let tempFolderPath = path.join(basePath, Utils.getInverseDateString());
        while (fileSystem.existsSync(tempFolderPath)) {
            tempFolderPath += "_";
        }
        fileSystem.mkdirSync(tempFolderPath, { recursive: true });
        return tempFolderPath;
    }

    /**
     * @typedef {{x: number, y: number, z:number}} Dimensions
     * @param {Dimensions} dim1
     * @param {Dimensions} dim2
     * @returns {boolean}
     */
    static checkDimensions(dim1, dim2) {
        return dim1.x == dim2.x && dim1.y == dim2.y && dim1.z == dim2.z;
    }

    /**
     * @template T, K
     * @param {Array<T>} array
     * @param {K & keyof T} key
     * @returns {Map<T[K], T>}
     */
    static arrayToMap(array, key) {
        const arrMap = new Map();
        array.forEach((element) => {
            arrMap.set(element[key], element);
        });
        return arrMap;
    }

    /**
     * @param {String} rawFilePath
     * @param {Number} width
     * @param {Number} height
     * @param {Number} depth
     * @param {String} outputPath
     * @param {Number} filterSize
     * @returns {Promise<String>}
     */
    static async meanFilter(
        rawFilePath,
        width,
        height,
        depth,
        outputPath,
        filterSize = null
    ) {
        const rawFileAbsolutePath = path.resolve(rawFilePath);
        const outputAbsolutePath = path.resolve(outputPath);

        /** @type {Array<Number | String>} */
        const params = [
            `\"${rawFileAbsolutePath}\"`,
            width,
            height,
            depth,
            `\"${outputAbsolutePath}\"`,
        ];

        if (filterSize != null) {
            params.push(filterSize);
        }

        const command = `${appConfig.nanoOetzi.python} \"${path.join(
            "src",
            "tools-python",
            "mean-filter.py"
        )}\" ${params.join(" ")}`;

        await execPromise(command);
        return outputPath;
    }

    /**
     * @param {String} checkpointPath
     * @returns {Promise<String>}
     */
    static async ckptToText(checkpointPath) {
        return new Promise((resolve, reject) => {
            const pythonProcess = spawn(appConfig.nanoOetzi.python, [
                path.join("src", "tools-python", "ckpt-to-text.py"),
                "-c",
                path.resolve(checkpointPath),
            ]);

            let outputData = "";

            pythonProcess.stdout.on("data", (data) => {
                outputData += data.toString(); // Accumulate data
            });

            pythonProcess.stderr.on("data", (error) => {
                reject(`Error: ${error}`);
            });

            pythonProcess.on("close", (code) => {
                if (code !== 0) {
                    reject(`Python process exited with code ${code}`);
                } else {
                    resolve(outputData);
                }
            });
        });
    }

    /**
     * @param {import("archiver").Archiver} archive
     * @param {import("../models/volume-data.mjs").VolumeDataSettings[]} settings
     * @param {String[]} rawFilePaths
     * @param {Number?} rawVolumeChannel
     * @returns {Promise<any>}
     */
    static async packVisualizationArchive(
        archive,
        settings,
        rawFilePaths,
        rawVolumeChannel = null
    ) {
        rawFilePaths.forEach((rawFilePath) => {
            archive.file(rawFilePath, {
                name: path.basename(rawFilePath),
            });
        });

        const settingsFileNames = [];

        for (const volumeSettings of settings) {
            if (volumeSettings.transferFunction) {
                const publicTFPath = path.join(
                    "transfer-functions",
                    volumeSettings.transferFunction
                );
                if (fileSystem.existsSync(publicTFPath)) {
                    archive.file(publicTFPath, {
                        name: path.join(
                            "transfer-functions",
                            volumeSettings.transferFunction
                        ),
                    });
                } else {
                    delete volumeSettings.transferFunction;
                }
            }

            const settingsFileName =
                Utils.stripExtension(volumeSettings.file) + ".json";

            archive.append(JSON.stringify(volumeSettings, null, 2), {
                name: settingsFileName,
            });

            settingsFileNames.push(settingsFileName);
        }

        const configData = { files: settingsFileNames };
        if (rawVolumeChannel) {
            configData.rawVolumeChannel = rawVolumeChannel;
        }

        archive.append(JSON.stringify(configData, null, 2), {
            name: `config.json`,
        });
    }

    /**
     * @param {Object} obj
     * @param {Object} template
     * @returns {Boolean}
     */
    static matchesTemplate(obj, template) {
        return Object.keys(template).every((key) => {
            const templateValue = template[key];
            const objValue = obj[key];

            if (Array.isArray(templateValue)) {
                if (!Array.isArray(objValue)) return false;

                return objValue.every((item) =>
                    Utils.matchesTemplate(item, templateValue[0])
                );
            } else if (
                typeof templateValue === "object" &&
                templateValue !== null
            ) {
                return Utils.matchesTemplate(objValue, templateValue);
            } else {
                return typeof objValue === templateValue;
            }
        });
    }
}
