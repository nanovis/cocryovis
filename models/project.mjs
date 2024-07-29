import {Volume} from "./volume.mjs";
import {Model} from "./model.mjs";

export class Project {
    constructor(name, description, userId, path = "", volumes = [], models = [], id = -1) {
        this.name = name;
        this.description = description;
        this.userId = userId;
        this.path = path;
        this.volumes = volumes;
        this.models = models;
        this.id = id;
        Object.preventExtensions(this);
    }

    static createProject(name, description, userId) {
        return new Project(name, description, userId);
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
        return new Project(dbProject.name, dbProject.description, dbProject.userId, dbProject.path, volumes, models, dbProject.id);
    }

    findVolume(volumeId) {
        return this.volumes.find(volume => volume.id === volumeId);
    }

    removeVolume(volumeId) {
        const volumeIndex = this.volumes.findIndex(volume => volume.id === volumeId);
        this.volumes.splice(volumeIndex, 1);
    }

    findModel(modelId) {
        return this.models.find(model => model.id === modelId);
    }

    removeModel(modelId) {
        const index = this.models.findIndex(model => model.id === modelId);
        this.models.splice(index, 1);
    }
}