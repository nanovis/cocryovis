import {Downloadable} from "./downloadable.mjs";
import fileSystem from "fs";
import {saveData} from "../tools/utils.mjs";

export class SparseLabeledVolume extends Downloadable {
    constructor(name, path) {
        super(path);
        this.name = name;
        Object.preventExtensions(this);
    }

    static async createSparseLabeledVolume(file, basePath) {
        const {fileNames, filePaths} = await saveData(file, basePath, [".raw"], true);
        if (fileNames.length === 0) {
            throw new Error(`No valid raw file found.`);
        }
        return new SparseLabeledVolume(fileNames[0], filePaths[0]);
    }

    static fromReference(dbReference) {
        return new SparseLabeledVolume(dbReference.name, dbReference.path);
    }

    async delete() {
        await fileSystem.rm(this.path, { recursive: true, force: true }, (err) => {
            if (err) {
                console.log(`Error deleting raw data ${this.name}: ${err}.`);
            }
        });
    }
}