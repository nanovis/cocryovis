import {Downloadable} from "./downloadable.mjs";
import fileSystem from "fs";
import {saveData} from "../tools/utils.mjs";

export class RawData extends Downloadable {
    constructor(name, path) {
        super(path);
        this.name = name;
        Object.preventExtensions(this);
    }

    static async createRawData(file, basePath) {
        const {fileNames, filePaths} = await saveData(file, basePath, [".raw"], true);
        if (fileNames.length === 0) {
            throw new Error(`No valid raw file found.`);
        }
        return new RawData(fileNames[0], filePaths[0]);
    }

    static fromReference(dbRawData) {
        return new RawData(dbRawData.name, dbRawData.path);
    }

    async delete() {
        await fileSystem.rm(this.path, { recursive: true, force: true }, (err) => {
            if (err) {
                console.log(`Error deleting raw data ${this.name}: ${err}.`);
            }
        });
    }
}