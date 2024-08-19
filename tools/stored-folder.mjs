import AdmZip from "adm-zip";
import path from "path";
import { rm } from "node:fs/promises";
import { fileNameFilter, isFileExtensionAccepted } from "./utils.mjs";

export class StoredFolder {
    constructor(folderName, folderPath) {
        this.folderName = folderName;
        this.folderPath = folderPath;
    }

    static fromReference(dbReference) {
        return new this(dbReference.folderName, dbReference.folderPath);
    }

    async addFile(file, moveFunction) {
        const filteredFileName = fileNameFilter(file.name);
        const fullPath = path.join(this.folderPath, filteredFileName);
        await moveFunction(file, filteredFileName, fullPath);
        return this;
    }

    prepareDataForDownload() {
        const zip = new AdmZip();
        zip.addLocalFolder(this.folderPath);
        const outputFileName = path.parse(this.folderPath).name;
        return {
            name: `${outputFileName}.zip`,
            zipBuffer: zip.toBuffer(),
        };
    }

    async delete() {
        await rm(this.folderPath, { recursive: true, force: true });
    }
}
