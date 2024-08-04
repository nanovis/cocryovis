import AdmZip from "adm-zip";
import path from "path";
import {rm} from 'node:fs/promises';

export class StoredFile {
    constructor(fileName, filePath) {
        this.fileName = fileName;
        this.filePath = filePath;
    }

    static fromReference(dbReference) {
        return new this(dbReference.fileName, dbReference.filePath);
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

    async delete() {
        await rm(this.filePath, { recursive: true, force: true });
    }
}