import {AbstractProjectController} from "../abstract-project-controller.mjs";
import {Project} from "../../models/project.mjs";
import LowdbManager from "../../tools/lowdb-manager.mjs";
import globalEventEmitter from "../../tools/global-event-system.mjs";

class LowdbProjectController extends AbstractProjectController {
    constructor() {
        super();
        this.db = LowdbManager.db;
        this.projects = this.db.data.projects;
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

    async addVolume(projectId, volumeId) {
        await super.addVolume(Number(projectId), Number(volumeId));
    }

    async removeVolume(projectId, volumeId) {
        await super.removeVolume(Number(projectId), Number(volumeId))
    }
}

const lowdbProjectControllerInstance = LowdbProjectController.getInstance();

export default lowdbProjectControllerInstance;