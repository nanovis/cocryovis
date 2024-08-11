import {fileNameFilter} from "../tools/utils.mjs";
import path from "path";
import fileSystem from "fs";

export class Project {
    constructor(id, name, description, userId, volumeIds = [], modelIds = []) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.userId = userId;
        this.volumeIds = volumeIds;
        this.modelIds = modelIds;
        Object.preventExtensions(this);
    }

    static createProject(id, name, description, userId) {
        return new Project(id, name, description, userId);
    }

    static fromReference(dbProject) {
        return new Project(dbProject.id, dbProject.name, dbProject.description,
            dbProject.userId, dbProject.volumeIds, dbProject.modelIds);
    }

    addVolume(volumeId) {
        if (!this.volumeIds.includes(volumeId)) {
            this.volumeIds.push(volumeId);
        }
    }

    removeVolume(volumeId) {
        const index = this.volumeIds.indexOf(volumeId);
        this.volumeIds.splice(index, 1);
    }

    addModel(modelId) {
        if (this.modelIds.includes(modelId)) {
            throw new Error(`Project ${this.id} (${this.name}): Model is already included in the project.`);
        }
        this.modelIds.push(modelId);
    }

    removeModel(modelId) {
        const index = this.modelIds.indexOf(modelId);
        if (index === -1) {
            throw new Error(`Project ${this.id} (${this.name}): Project does not have the model.`);
        }
        this.modelIds.splice(index, 1);
    }

    async delete() {
    }
}