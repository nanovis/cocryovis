// @ts-check

import Utils from "./utils.mjs";
import path from "path";
import AdmZip from "adm-zip";
import fileUpload from "express-fileupload";
import fileSystem from "fs";
import appConfig from "../tools/config.mjs";
import { rm } from "node:fs/promises";
import { ApiError } from "./error-handler.mjs";
import fsPromises from "fs/promises";

export class PendingUpload {
    /**
     * @return {String}
     */
    get fileName() {
        throw new Error("Method not implemented");
    }

    /**
     * @return {String}
     */
    get filteredFileName() {
        throw new Error("Method not implemented");
    }

    /**
     * @return {String}
     */
    get fileExtension() {
        throw new Error("Method not implemented");
    }

    /**
     * @return {Promise<Buffer>}
     */
    async getData() {
        throw new Error("Method not implemented");
    }

    /**
     * @param {String} folderPath
     * @param {String?} fileNameOverride
     * @return {Promise<String>}
     */
    async saveAs(folderPath, fileNameOverride = null) {
        throw new Error("Method not implemented");
    }
}

/**
 * @extends {PendingUpload}
 */
export class PendingFile extends PendingUpload {
    /**
     * @param {fileUpload.UploadedFile} file
     */
    constructor(file) {
        super();
        /** @type {fileUpload.UploadedFile} */
        this.file = file;
        Object.preventExtensions(this);
    }

    /**
     * @return {String}
     */
    get fileName() {
        return this.file.name;
    }

    /**
     * @return {String}
     */
    get filteredFileName() {
        return Utils.fileNameFilter(this.file.name);
    }

    /**
     * @return {String}
     */
    get fileExtension() {
        return path.extname(this.file.name);
    }

    /**
     * @return {Promise<Buffer>}
     */
    async getData() {
        const contents = await fsPromises.readFile(this.file.tempFilePath);
        return contents;
    }

    /**
     * @return {Promise<String>}
     */
    async saveAs(folderPath, fileNameOverride = null) {
        const filteredFileName =
            fileNameOverride != null
                ? fileNameOverride
                : Utils.fileNameFilter(this.file.name);
        const fullPath = path.join(folderPath, filteredFileName);
        if (fileSystem.existsSync(fullPath)) {
            if (appConfig.safeMode) {
                throw new Error(
                    `Error saving file: File with the same name already exists.`
                );
            } else {
                await rm(fullPath, { recursive: true, force: true });
            }
        }
        await this.file.mv(fullPath);
        return fullPath;
    }
}

/**
 * @extends {PendingUpload}
 */
export class PendingZipFile extends PendingUpload {
    /**
     * @param {AdmZip} zip
     * @param {AdmZip.IZipEntry} entry
     */
    constructor(zip, entry) {
        super();
        /** @type {AdmZip} */
        this.zip = zip;
        /** @type {AdmZip.IZipEntry} */
        this.entry = entry;
        Object.preventExtensions(this);
    }

    /**
     * @return {String}
     */
    get fileName() {
        return this.entry.name;
    }

    /**
     * @return {String}
     */
    get filteredFileName() {
        return Utils.fileNameFilter(this.entry.name);
    }

    /**
     * @return {String}
     */
    get fileExtension() {
        return path.extname(this.entry.name);
    }

    /**
     * @return {Promise<Buffer>}
     */
    async getData() {
        return this.entry.getData();
    }

    /**
     * @return {Promise<String>}
     */
    async saveAs(folderPath, fileNameOverride = null) {
        const filteredFileName =
            fileNameOverride != null
                ? fileNameOverride
                : Utils.fileNameFilter(this.entry.name);
        const fullPath = path.join(folderPath, filteredFileName);

        if (!fileSystem.existsSync(folderPath)) {
            fileSystem.mkdirSync(folderPath, { recursive: true });
        }

        if (fileSystem.existsSync(fullPath)) {
            if (appConfig.safeMode) {
                throw new Error(
                    `Error saving file: File with the same name already exists.`
                );
            } else {
                await rm(fullPath, { recursive: true, force: true });
            }
        }
        this.zip.extractEntryTo(
            this.entry,
            folderPath,
            false,
            true,
            false,
            filteredFileName
        );

        return fullPath;
    }
}

/**
 * @param {fileUpload.UploadedFile[]} files
 * @param {String[]?} acceptedExtensions
 * @returns {Promise<PendingUpload[]>}
 */
export async function unpackFiles(files, acceptedExtensions = []) {
    const result = [];

    for (const file of files) {
        if (path.extname(file.name) === ".zip") {
            const zipFileContents = await fsPromises.readFile(
                file.tempFilePath
            );
            let zip = new AdmZip(zipFileContents);
            const zipEntries = zip.getEntries();
            for (const entry of zipEntries) {
                if (
                    Utils.isFileExtensionAccepted(
                        entry.name,
                        acceptedExtensions
                    )
                ) {
                    result.push(new PendingZipFile(zip, entry));
                }
            }
        } else if (
            Utils.isFileExtensionAccepted(file.name, acceptedExtensions)
        ) {
            result.push(new PendingFile(file));
        }
    }

    return result;
}

/**
 * @param {String[]} files
 * @param {String} outputName
 */
export function prepareDataForDownload(files, outputName) {
    if (files.length === 0) {
        throw new ApiError(404, `No files to download.`);
    }
    const zip = new AdmZip();
    for (const filePath of files) {
        zip.addLocalFile(filePath);
    }
    return {
        name: `${outputName}.zip`,
        zipBuffer: zip.toBuffer(),
    };
}
