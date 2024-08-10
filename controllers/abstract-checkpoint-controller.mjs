import {AbstractController} from "./abstract-controller.mjs";

export class AbstractCheckpointController extends AbstractController {
    constructor() {
        super();
        if(this.constructor === AbstractCheckpointController) {
            throw new Error("Class is of abstract type and can't be instantiated");
        }
    }

    getById(id) {
        throw new Error('Method not implemented');
    }

    getByIds(ids) {
        throw new Error('Method not implemented');
    }

    getCheckpointsFromModel(modelId) {
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
}