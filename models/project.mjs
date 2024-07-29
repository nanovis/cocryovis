import {Volume} from "./volume.mjs";
import {Model} from "./model.mjs";
import {fileNameFilter} from "../tools/utils.mjs";
import path from "path";
import fileSystem from "fs";

export class Project {
    subfolders = {
        volumes: 'volumes',
        models: 'models'
    };

    constructor(id, name, description, userId, path = "", volumes = [], models = []) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.userId = userId;
        this.path = path;
        this.volumes = volumes;
        this.models = models;
        Object.preventExtensions(this);
    }

    static createProject(id, name, description, userId, basePath) {
        const project = new Project(id, name, description, userId);
        project.createDirectory(basePath);
        return project;
    }

    createDirectory(basePath) {
        const projectFolder = this.id + "_" + fileNameFilter(this.name);
        let projectPath = path.join(basePath, projectFolder)
        this.path = projectPath;
        if (fileSystem.existsSync(projectPath)) {
            throw new Error(`Project directory already exists`);
        }
        fileSystem.mkdirSync(projectPath, { recursive: true });

        for (const subfolder in this.subfolders) {
            fileSystem.mkdirSync(path.join(projectPath, this.subfolders[subfolder]));
        }
    }

    async delete() {
        if (this.volumes) {
            for (const volume of this.volumes) {
                await volume.delete();
            }
        }
        if (this.models) {
            for (const model of this.models) {
                await model.delete();
            }
        }
        await fileSystem.rm(this.path, { recursive: true, force: true }, (err) => {
            if (err) {
                console.log(`Error deleting ${this.name}: ${err}.`);
            }
        });
    }

    static fromReference(dbProject) {
        const volumes = [];
        if (dbProject.volumes) {
            for (const volume of dbProject.volumes) {
                volumes.push(Volume.fromReference(volume));
            }
        }
        const models = []
        if (dbProject.models) {
            for (const model of dbProject.models) {
                models.push(Model.fromReference(model));
            }
        }
        return new Project(dbProject.id, dbProject.name, dbProject.description,
            dbProject.userId, dbProject.path, volumes, models);
    }

    findVolume(volumeId) {
        return this.volumes.find(volume => volume.id === volumeId);
    }

    async removeVolume(volumeId) {
        const volumeIndex = this.volumes.findIndex(volume => volume.id === volumeId);
        if (volumeIndex === -1){
            throw new Error(`Volume does not exists`);
        }
        const volume = this.volumes[volumeIndex];
        this.volumes.splice(volumeIndex, 1);
        await volume.delete();
    }

    findModel(modelId) {
        return this.models.find(model => model.id === modelId);
    }

    async removeModel(modelId) {
        const index = this.models.findIndex(model => model.id === modelId);
        if (index === -1){
            throw new Error(`Model does not exists`);
        }
        const model = this.models[index];
        this.models.splice(index, 1);
        await model.delete();
    }
}