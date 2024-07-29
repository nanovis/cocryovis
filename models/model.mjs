import {fileNameFilter} from "../tools/utils.mjs";
import path from "path";
import fileSystem from "fs";

export class Model {
    subfolders = {
        checkpoints: 'checkpoints',
        inferenceData: 'inference-data',
        predictions: 'predictions',
    };

    constructor(id, name, description, path, checkpoints, inferenceData, predictions) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.path = path;
        this.checkpoints = checkpoints;
        this.inferenceData = inferenceData;
        this.predictions = predictions;
        Object.preventExtensions(this);
    }

    static createModel(id, name, description, basePath) {
        const model = new Model(id, name, description);
        model.createDirectory(basePath);
        return new Model(id, name, description);
    }

    createDirectory(basePath) {
        const folderName = this.id + "_" + fileNameFilter(this.name);
        const folderPath = path.join(basePath, folderName);
        this.path = folderPath;
        if (fileSystem.existsSync(folderPath)) {
            throw new Error(`Model directory already exists`);
        }
        fileSystem.mkdirSync(folderPath, {recursive: true});

        for (const subfolder in this.subfolders) {
            fileSystem.mkdirSync(path.join(folderPath, this.subfolders[subfolder]));
        }
    }

    async delete() {
        await fileSystem.rm(this.path, { recursive: true, force: true }, (err) => {
            if (err) {
                console.log(`Error deleting ${this.name}: ${err}.`);
            }
        });
    }

    static fromReference(dbModel) {
        return new Model(dbModel.id, dbModel.name, dbModel.description, dbModel.path, dbModel.checkpoints,
            dbModel.inferenceData, dbModel.predictions);
    }
}