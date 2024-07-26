import { IProjectModel } from "../i-project-model.mjs";
import {Project} from "../project.mjs";
import {Volume} from "../volume.mjs";
import LowdbManager from "../../tools/lowdb-manager.mjs";
import fileSystem from "fs";

export class LowdbProjectModel extends IProjectModel {
    constructor(config) {
        super(config);
        this.db = LowdbManager.db;
        this.projects = this.db.data.projects;
        Object.preventExtensions(this);
    }

    getUserProjects(userId) {
        userId = Number(userId);

        const projectReferences = this.projects.filter((p) => p.userId === userId);
        return projectReferences.map((p) => Project.fromReference(p));
    }

    getById(id) {
        id = Number(id);

        const projectReference = this.projects.find((p) => p.id === id);
        return Project.fromReference(projectReference);
    }

    async create(project) {
        if (this.projects.length === 0) {
            project.id = 1;
        } else {
            project.id = this.projects.at(-1).id + 1;
        }

        try {
            this.createProjectDirectory(project);
        }
        catch (error) {
            throw error;
        }

        await this.db.update(({projects}) => projects.push(project))
        return project.id;
    }

    async update(id, project) {
        id = Number(id);
        const projectIndex = this.projects.findIndex((p) => p.id === id);

        await this.db.update(({ projects }) => projects[projectIndex] = project);
        return project;
    }

    async delete(id) {
        id = Number(id);

        const project = this.getById(id);
        this.removeProjectDirectory(project);
        await this.projects.remove({ id }).write();
    }

    async addVolume(projectId, name, description){
        projectId = Number(projectId);

        const volume = Volume.createVolume(name, description);
        const project = this.getById(projectId);

        if (!Object.hasOwn(project, 'volumes')) {
            project.volumes = []
        }

        if (project.volumes.length === 0) {
            volume.id = 1;
        } else {
            volume.id = project.volumes.at(-1).id + 1;
        }

        try {
            this.createVolumeDirectory(project, volume)
        }
        catch (error) {
            throw error;
        }

        project.volumes.push(volume);

        await this.update(projectId, project);
        return volume.id;
    }

    async removeVolume(projectId, volumeId){
        await super.removeVolume(Number(projectId), Number(volumeId));
    }

    async addRawVolume(projectId, volumeId, file) {
        await super.addRawVolume(Number(projectId), Number(volumeId), file);
    }

    async removeRawVolume(projectId, volumeId) {
        await super.removeRawVolume(Number(projectId), Number(volumeId));
    }
}