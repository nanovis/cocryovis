import lowdbProjectModelInstance from "./lowdb/lowdb-project-model.mjs";
import lowdbVolumeModelInstance from "./lowdb/lowdb-volume-model.mjs";

export class ModelFactory {
    static createProjectModel(type) {
        if (type === 'lowdb') {
            return lowdbProjectModelInstance;
        } else {
            throw new Error('Unsupported repository type');
        }
    }

    static createVolumeModel(type, config) {
        if (type === 'lowdb') {
            return lowdbVolumeModelInstance;
        } else {
            throw new Error('Unsupported repository type');
        }
    }
}