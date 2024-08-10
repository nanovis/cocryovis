import lowdbProjectController from "./lowdb/lowdb-project-controller.mjs";
import lowdbVolumeController from "./lowdb/lowdb-volume-controller.mjs";
import lowdbModelController from "./lowdb/lowdb-model-controller.mjs";
import lowdbCheckpointController from "./lowdb/lowdb-checkpoint-controller.mjs";
import lowdbVolumeDataController from "./lowdb/lowdb-volume-data-controller.mjs";

export class ControllerFactory {
    static getProjectController(type) {
        if (type === 'lowdb') {
            return lowdbProjectController;
        } else {
            throw new Error('Unsupported repository type');
        }
    }

    static getVolumeController(type) {
        if (type === 'lowdb') {
            return lowdbVolumeController;
        } else {
            throw new Error('Unsupported repository type');
        }
    }

    static getVolumeDataController(type) {
        if (type === 'lowdb') {
            return lowdbVolumeDataController;
        } else {
            throw new Error('Unsupported repository type');
        }
    }

    static getModelController(type) {
        if (type === 'lowdb') {
            return lowdbModelController;
        } else {
            throw new Error('Unsupported repository type');
        }
    }

    static getCheckpointController(type) {
        if (type === 'lowdb') {
            return lowdbCheckpointController;
        } else {
            throw new Error('Unsupported repository type');
        }
    }
}