// @ts-check

import fileSystem from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { exec } from "child_process";
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
     * @param {String} currentPath
     * @param {String} filePath
     */
    static publicDataPath(currentPath, filePath) {
        return path.join(
            path.relative(currentPath, "/"),
            path.relative("./data", filePath)
        );
    }

    /**
     * @param {String} currentPath
     * @param {String} filePath
     */
    static publicPath(currentPath, filePath) {
        return path.join(path.relative(currentPath, "/"), filePath);
    }

    static async saveData(
        files,
        uploadPath,
        acceptedFileExtensions = [],
        singleFileOnly = false
    ) {
        function isFileExtensionAccepted(filename, acceptedFileExtensions) {
            return (
                acceptedFileExtensions.length === 0 ||
                acceptedFileExtensions.some((extension) =>
                    filename.endsWith(extension)
                )
            );
        }

        const fileNames = [];
        const filePaths = [];

        const promises = [];

        if (!fileSystem.existsSync(uploadPath)) {
            fileSystem.mkdirSync(uploadPath, { recursive: true });
        }
        if (Array.isArray(files)) {
            for (const file of files) {
                if (
                    isFileExtensionAccepted(file.name, acceptedFileExtensions)
                ) {
                    const filteredFileName = Utils.fileNameFilter(file.name);
                    const fullPath = path.join(uploadPath, filteredFileName);
                    fileNames.push(filteredFileName);
                    filePaths.push(fullPath);
                    promises.push(file.mv(fullPath));
                    if (singleFileOnly) {
                        break;
                    }
                }
            }
        } else if (files.name.endsWith(".zip")) {
            let zip = new AdmZip(files.data);
            const zipEntries = zip.getEntries();
            for (const entry of zipEntries) {
                if (
                    isFileExtensionAccepted(entry.name, acceptedFileExtensions)
                ) {
                    const filteredFileName = Utils.fileNameFilter(entry.name);
                    zip.extractEntryTo(
                        entry,
                        uploadPath,
                        false,
                        true,
                        false,
                        filteredFileName
                    );
                    fileNames.push(filteredFileName);
                    filePaths.push(path.join(uploadPath, filteredFileName));
                    if (singleFileOnly) {
                        break;
                    }
                }
            }
        } else if (
            isFileExtensionAccepted(files.name, acceptedFileExtensions)
        ) {
            const filteredFileName = Utils.fileNameFilter(files.name);
            const fullPath = path.join(uploadPath, filteredFileName);
            await files.mv(fullPath);
            fileNames.push(filteredFileName);
            filePaths.push(path.join(uploadPath, filteredFileName));
        }

        await Promise.all(promises);

        return { fileNames: fileNames, filePaths: filePaths };
    }

    /**
     * @param {String} inputFile
     * @param {String} outputPath
     */
    static async mrcToRaw(inputFile, outputPath) {
        const command = `${appConfig.nanoOetzi.python} \"${path.join(
            "tools-python",
            "mrc-to-raw.py"
        )}\" -i \"${inputFile}\" -o \"${outputPath}\"`;
        const { stdout, stderr } = await execPromise(command);
        fs.writeFileSync(
            path.join(outputPath, "mrc-to-raw.log"),
            `Converting mrc file to a raw file\n\nstdout:\n${stdout}\n\stderr:\n${stderr}`
        );
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
        const fileName = path.parse(filePath).name;
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
}
