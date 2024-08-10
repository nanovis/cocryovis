import {AbstractController} from "./abstract-controller.mjs";

export class AbstractModelController extends AbstractController {
    constructor() {
        super();
        if(this.constructor === AbstractModelController) {
            throw new Error("Class is of abstract type and can't be instantiated");
        }
    }

    getAllModels() {
        throw new Error('Method not implemented');
    }

    getById(id) {
        throw new Error('Method not implemented');
    }

    getByIds(ids) {
        throw new Error('Method not implemented');
    }

    getModelsFromProject(projectId) {
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

    async addCheckpoint(id, checkpointId) {
        throw new Error('Method not implemented');
    }

    async removeCheckpoint(id, checkpointId) {
        throw new Error('Method not implemented');
    }
}