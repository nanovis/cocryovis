import {IModel} from "./i-model.mjs";
import {Project} from "./project.mjs";

export class IProjectModel extends IModel {
    constructor() {
        super();
        if(this.constructor === IProjectModel) {
            throw new Error("Class is of abstract type and can't be instantiated");
        }
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
}