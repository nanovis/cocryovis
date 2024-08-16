import {rm} from "node:fs/promises";
import path from "path";
import fileSystem from "fs";
import AdmZip from "adm-zip";
import {SettingsFile} from "./settings-file.mjs";
import {RawVolumeFile} from "./raw-volume-file.mjs";
import {StoredFile} from "./stored-file.mjs";

export class Result {
    static acceptedFileExtensions
        = ['.log'].concat(RawVolumeFile.acceptedFileExtensions, SettingsFile.acceptedFileExtensions);

    constructor(id, volumeId, modelId, checkpointId, userId, path, files = [], rawVolumeChannel = -1) {
        this.id = id;
        this.volumeId = volumeId;
        this.modelId = modelId;
        this.checkpointId = checkpointId;
        this.userId = userId;
        this.path = path;

        this.files = files
        this.rawVolumeChannel = rawVolumeChannel;
    }

    static fromReference(dbReference) {
        const files = []
        for (const dbFile of dbReference.files) {
            if (SettingsFile.acceptedFileExtensions.includes(path.extname(dbFile.fileName))) {
                files.push(new SettingsFile(dbFile.fileName, dbFile.filePath))
            }
            else if (RawVolumeFile.acceptedFileExtensions.includes(path.extname(dbFile.fileName))) {
                files.push(new RawVolumeFile(dbFile.fileName, dbFile.filePath))
            }
            else {
                files.push(new StoredFile(dbFile.fileName, dbFile.filePath))
            }
        }

        return new Result(dbReference.id, dbReference.volumeId, dbReference.modelId, dbReference.checkpointId,
            dbReference.userId,dbReference. path, files, dbReference.rawVolumeChannel)
    }

    static createResult(id, volumeId, modelId, checkpointId, userId, basePath) {
        console.log(`Creating new Result object with id ${id}.`);

        const folderPath = path.join(basePath, id.toString());
        if (fileSystem.existsSync(folderPath)) {
            throw new Error(`Result directory already exists`);
        }
        fileSystem.mkdirSync(folderPath, {recursive: true});

        return new Result(id, volumeId, modelId, checkpointId, userId, folderPath);
    }

    addFile(filePath) {
        if (SettingsFile.acceptedFileExtensions.includes(path.extname(filePath))) {
            this.files.push(new SettingsFile(path.basename(filePath), filePath));
        }
        else if (RawVolumeFile.acceptedFileExtensions.includes(path.extname(filePath))) {
            this.files.push(new RawVolumeFile(path.basename(filePath), filePath));
        }
        else {
            this.files.push(new StoredFile(path.basename(filePath), filePath));
        }

        if (filePath.endsWith("_inverted.json")) {
            this.rawVolumeChannel = this.files.length - 1;
        }
    }

    getFile(index) {
        if (index >= this.files.length) {
            throw new Error(`Result ${this.id} does not have a file with index ${index}`);
        }

        return this.files[index];
    }

    prepareDataForDownload() {
        if (this.files.length === 0) {
            throw new Error(`Result ${this.id} has no associated files`);
        }
        const zip = new AdmZip();
        for (const file of this.files) {
            zip.addLocalFile(file.filePath);
        }
        const outputFileName = `Result_${this.id}`;
        return {
            name: `${outputFileName}.zip`,
            zipBuffer: zip.toBuffer()
        };
    }

    async delete() {
        await rm(this.path, { recursive: true, force: true });
    }
}