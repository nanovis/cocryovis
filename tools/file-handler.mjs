// @ts-check

import { fileNameFilter, isFileExtensionAccepted } from "./utils.mjs";
import path from "path";
import AdmZip from "adm-zip";
import fileUpload from "express-fileupload";

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
    get fileExtension() {
        throw new Error("Method not implemented");
    }

    /**
     * @param {String} folderPath
     * @return {Promise<String>}
     */
    async saveAs(folderPath) {
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
    get fileExtension() {
        return path.extname(this.file.name);
    }

    /**
     * @return {Promise<String>}
     */
    async saveAs(folderPath) {
        const filteredFileName = fileNameFilter(this.file.name);
        const fullPath = path.join(folderPath, filteredFileName);
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
    get fileExtension() {
        return path.extname(this.entry.name);
    }

    /**
     * @return {Promise<String>}
     */
    async saveAs(folderPath) {
        const filteredFileName = fileNameFilter(this.entry.name);

        this.zip.extractEntryTo(
            this.entry,
            folderPath,
            false,
            true,
            false,
            filteredFileName
        );

        return path.join(folderPath, filteredFileName);
    }
}

/**
 * @param {fileUpload.UploadedFile[]} files
 * @param {String[]?} acceptedExtensions
 * @returns {PendingUpload[]}
 */
export function unpackFiles(files, acceptedExtensions = []) {
    const result = [];

    for (const file of files) {
        if (path.extname(file.name) === ".zip") {
            let zip = new AdmZip(files[0].data);
            const zipEntries = zip.getEntries();
            for (const entry of zipEntries) {
                if (isFileExtensionAccepted(entry.name, acceptedExtensions)) {
                    result.push(new PendingZipFile(zip, entry));
                }
            }
        } else if (isFileExtensionAccepted(file.name, acceptedExtensions)) {
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
        throw new Error(`No files to download.`);
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
