import {AbstractController} from "./abstract-controller.mjs";
import globalEventEmitter from "../tools/global-event-system.mjs";

export class AbstractProjectController extends AbstractController {
    constructor() {
        super();
        if(this.constructor === AbstractProjectController) {
            throw new Error("Class is of abstract type and can't be instantiated");
        }
        globalEventEmitter.on('volumeCreated', async (volume) => {
            await this.onVolumeCreated(volume);
        });
        globalEventEmitter.on('volumeDeleted', async (volume) => {
            await this.onVolumeDeleted(volume);
        });
    }

    getAllProjects() {
        throw new Error('Method not implemented');
    }

    getUserProjects(userId) {
        throw new Error('Method not implemented');
    }

    getById(id) {
        throw new Error('Method not implemented');
    }

    getByIds(ids) {
        throw new Error('Method not implemented');
    }

    async create(name, description, userId) {
        throw new Error('Method not implemented');
    }

    async update(project) {
        throw new Error('Method not implemented');
    }

    async delete(id) {
        throw new Error('Method not implemented');
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

    async onVolumeCreated(volume) {
        const projects = this.getByIds(volume.projectIds);
        for (const project of projects) {
            project.addVolume(volume.id);
            await this.update(project);
        }
    }

    async onVolumeDeleted(volume) {
        const projects = this.getByIds(volume.projectIds);
        for (const project of projects) {
            if (project.volumeIds.includes(volume.id)) {
                project.removeVolume(volume.id);
                await this.update(project);
            }
        }
    }
}