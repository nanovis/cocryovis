import lowdbProjectModelController from "./lowdb/lowdb-project-controller.mjs";
import lowdbVolumeModelController from "./lowdb/lowdb-volume-controller.mjs";

export class ControllerFactory {
    static getProjectController(type) {
        if (type === 'lowdb') {
            return lowdbProjectModelController;
        } else {
            throw new Error('Unsupported repository type');
        }
    }

    static getVolumeController(type) {
        if (type === 'lowdb') {
            return lowdbVolumeModelController;
        } else {
            throw new Error('Unsupported repository type');
        }
    }
}