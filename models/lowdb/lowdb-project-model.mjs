import { IProjectModel } from "../i-project-model.mjs";
import {Project} from "../project.mjs";
import LowdbManager from "../../tools/lowdb-manager.mjs";
import globalEventEmitter from "../../tools/global-event-system.mjs";

class LowdbProjectModel extends IProjectModel {
    constructor() {
        super();
        this.db = LowdbManager.db;
        this.projects = this.db.data.projects;
        globalEventEmitter.on('volumeCreated', async (volume) => {
            await this.onVolumeCreated(volume);
        });
        globalEventEmitter.on('volumeDeleted', async (volume) => {
            await this.onVolumeDeleted(volume);
        });
        Object.preventExtensions(this);
    }

    getAllProjects() {
        return this.projects.map((p) => Project.fromReference(p));
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

    getByIds(ids) {
        const dbReferences = this.projects.filter((p) => ids.includes(p.id));
        return dbReferences.map((p) => Project.fromReference(p));
    }

    async create(name, description, userId) {
        try {
            let newId = 1;
            if (this.projects.length > 0) {
                newId = this.projects.at(-1).id + 1;
            }

            const project = Project.createProject(newId, name, description, userId, this.config.projectsPath);

            await this.db.update(({projects}) => projects.push(project))
            return project.id;
        }
        catch (error) {
            throw error;
        }
    }

    async update(project) {
        const projectIndex = this.projects.findIndex((p) => p.id === project.id);

        await this.db.update(({ projects }) => projects[projectIndex] = project);
        return project;
    }

    async delete(id) {
        id = Number(id);

        const index = this.projects.findIndex((p) => p.id === id);

        if (index === -1) {
            throw new Error(`Project ${id} does not exist.`);
        }

        const project = Project.fromReference(this.projects[index]);

        globalEventEmitter.emit('projectDeleted', project);

        await project.delete();
        await this.db.update(({ projects }) => projects.splice(index, 1));
    }

    async onVolumeCreated(volume) {
        for (const projectId of volume.projectIds) {
            const project = this.getById(projectId);
            project.addVolume(volume.id);
            await this.update(project);
        }
    }

    async onVolumeDeleted(volume) {
        const projects = this.getByIds(volume.projectIds);
        for (const project in projects) {
            if (volume.id in project.volumeIds) {
                await this.removeVolume(project.id, volume.id);
                await this.update(project);
            }
        }
    }

    async addVolume(projectId, volumeId) {
        const project = this.getById(projectId);
        project.addVolume(volumeId);
        await this.update(project);
    }

    async removeVolume(projectId, volumeId) {
        const project = this.getById(projectId);
        project.removeVolume(volumeId);
        await this.update(project);
    }
}

const lowdbProjectModelInstance = LowdbProjectModel.getInstance();

export default lowdbProjectModelInstance;