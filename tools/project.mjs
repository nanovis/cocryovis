import {Volume} from "./volume.mjs";

export class Project {
    constructor(name, description, userId, path="", volumes = [], id = -1) {
        this.name = name;
        this.description = description;
        this.userId = userId;
        this.path = path;
        this.volumes = volumes;
        this.id = id;
    }

    static fromReference(dbProject) {
        return new Project(dbProject.name, dbProject.description, dbProject.userId, dbProject.path, dbProject.volumes, dbProject.id);
    }

    findVolumeIndex(volumeId) {
        return this.volumes.findIndex(volume => volume.id === volumeId);
    }

    findVolume(volumeId) {
        return this.volumes.find(volume => volume.id === volumeId);
    }

    getVolumeFromIndex(volumeIndex) {
        return this.volumes[volumeIndex];
    }
}