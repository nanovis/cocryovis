import {StoredFile} from "./stored-file.mjs";
import AdmZip from "adm-zip";
import path from "path";
import {fileNameFilter} from "../tools/utils.mjs";
import {rm} from "node:fs/promises";

export class Checkpoint extends StoredFile {
    static acceptedFileExtensions = [".ckpt"];

    constructor(id, userId, modelIds, folderPath, fileName , filePath) {
        super(fileName, filePath);

        this.id = id;
        this.userId = userId;
        this.modelIds = modelIds;
        this.folderPath = folderPath;
        Object.preventExtensions(this);
    }

    static fromReference(dbReference) {
        return new Object.assign(new Checkpoint(), dbReference);
    }

    static async fromFile(file, uploadPath, id, userId, modelId) {
        if (Array.isArray(file)) {
            throw new Error(`Checkpoint has to consist of single file only.`);
        }

        const fullUploadPath = path.join(uploadPath, id);

        let storedFile = null;

        if (file.name.endsWith('.zip')) {
            let zip = new AdmZip(files.data);
            const zipEntries = zip.getEntries();
            for (const entry of zipEntries) {
                storedFile = await super.fromFile(entry, fullUploadPath, Checkpoint.acceptedFileExtensions, (file, filteredFileName, fullPath) =>
                    zip.extractEntryTo(entry, this.path, false, true, false, filteredFileName));
            }
        } else {
            storedFile = await super.fromFile(file, fullUploadPath, Checkpoint.acceptedFileExtensions,
                async (file, filteredFileName, fullPath) => await file.mv(fullPath));
        }

        return new Checkpoint(id, userId, [modelId], fullUploadPath, storedFile.fileName, storedFile.filePath);
    }

    addToModel(modelId) {
        if (this.modelIds.includes(modelId)) {
            throw new Error(`Checkpoint ${this.id} (${this.fileName}): Checkpoint is already included in the model.`);
        }
        this.modelIds.push(modelId);
    }

    removeFromModel(modelId) {
        const index = this.modelIds.indexOf(modelId);
        if (index === -1) {
            throw new Error(`Model ${this.id} (${this.fileName}): Checkpoint is not included in the model.`);
        }
        this.modelIds.splice(index, 1);
    }

    async delete() {
        await rm(this.folderPath, { recursive: true, force: true });
    }
}