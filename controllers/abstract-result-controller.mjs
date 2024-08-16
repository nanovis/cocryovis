import {AbstractController} from "./abstract-controller.mjs";

export class AbstractResultController extends AbstractController {
    constructor() {
        super();
        if(this.constructor === AbstractResultController) {
            throw new Error("Class is of abstract type and can't be instantiated");
        }
    }

    getById(id) {
        throw new Error('Method not implemented');
    }

    getByIds(ids) {
        throw new Error('Method not implemented');
    }

    getResultsVolumesFromVolume(volumeId) {
        throw new Error('Method not implemented');
    }

    getResultsVolumesFromModel(modelId) {
        throw new Error('Method not implemented');
    }

    getResultsVolumesFromCheckpoint(checkpointId) {
        throw new Error('Method not implemented');
    }

    async create(volumeId, modelId, checkpointId, userId) {
        throw new Error('Method not implemented');
    }

    async update(project) {
        throw new Error('Method not implemented');
    }

    async delete(id) {
        throw new Error('Method not implemented');
    }
}