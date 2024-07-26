import {LowdbProjectModel} from "./lowdb/lowdb-project-model.mjs";

export class ModelFactory {
    static createProjectModel(type, config) {
        if (type === 'lowdb') {
            return new LowdbProjectModel(config);
        } else {
            throw new Error('Unsupported repository type');
        }
    }
}