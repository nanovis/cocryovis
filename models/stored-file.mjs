import AdmZip from "adm-zip";
import path from "path";
import {rm} from 'node:fs/promises';
import {fileNameFilter, isFileExtensionAccepted} from "../tools/utils.mjs";

export class StoredFile {
    constructor(fileName, filePath) {
        this.fileName = fileName;
        this.filePath = filePath;
    }

    static fromReference(dbReference) {
        return new this(dbReference.fileName, dbReference.filePath);
    }

    static async fromFile(file, uploadPath, acceptedFileExtensions, moveFunction) {
        if (isFileExtensionAccepted(file.name, acceptedFileExtensions)) {
            const filteredFileName = fileNameFilter(file.name);
            const fullPath = path.join(uploadPath, filteredFileName);
            await moveFunction(file, filteredFileName, fullPath);
            return new StoredFile(filteredFileName, fullPath);
        }
        throw new Error("Incorrect file extension");
    }

    async delete() {
        await rm(this.filePath, { recursive: true, force: true });
    }

    prepareDataForDownload() {
        const zip = new AdmZip();
        zip.addLocalFile(this.filePath);
        const outputFileName = path.parse(this.filePath).name;
        return {
            name: `${outputFileName}.zip`,
            zipBuffer: zip.toBuffer()
        };
    }
}