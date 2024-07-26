import {Volume} from "./volume.mjs";

export class Project {
    constructor(name, description, userId, path, volumes, id) {
        this.name = name;
        this.description = description;
        this.userId = userId;
        this.path = path;
        this.volumes = volumes;
        this.id = id;
        Object.preventExtensions(this);
    }

    static createProject(name, description, userId) {
        return new Project(name, description, userId, "", [], -1);
    }

    static fromReference(dbProject) {
        const volumes = [];
        for (const volume of dbProject.volumes) {
            volumes.push(Volume.fromReference(volume));
        }
        return new Project(dbProject.name, dbProject.description, dbProject.userId, dbProject.path, volumes, dbProject.id);
    }

    findVolume(volumeId) {
        return this.volumes.find(volume => volume.id === volumeId);
    }

    removeVolume(volumeId) {
        const volumeIndex = this.volumes.findIndex(volume => volume.id === volumeId);
        this.volumes.splice(volumeIndex, 1);
    }
}