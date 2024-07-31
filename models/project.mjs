import {fileNameFilter} from "../tools/utils.mjs";
import path from "path";
import fileSystem from "fs";

export class Project {
    static subfolders = {
        // volumes: 'volumes',
        // models: 'models'
    };

    constructor(id, name, description, userId, path = "", volumeIds = []) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.userId = userId;
        this.path = path;
        this.volumeIds = volumeIds;
        Object.preventExtensions(this);
    }

    static createProject(id, name, description, userId, basePath) {
        const project = new Project(id, name, description, userId);
        project.createDirectory(basePath);
        return project;
    }

    createDirectory(basePath) {
        const projectFolder = this.id + "_" + fileNameFilter(this.name);
        let projectPath = path.join(basePath, projectFolder)
        this.path = projectPath;
        if (fileSystem.existsSync(projectPath)) {
            throw new Error(`Project directory already exists`);
        }
        fileSystem.mkdirSync(projectPath, { recursive: true });

        for (const subfolder in Project.subfolders) {
            fileSystem.mkdirSync(path.join(projectPath, Project.subfolders[subfolder]));
        }
    }

    addVolume(volumeId) {
        if (!this.volumeIds.includes(volumeId)) {
            this.volumeIds.push(volumeId);
        }
    }

    removeVolume(volumeId) {
        const index = this.volumeIds.indexOf(volumeId);
        this.volumeIds.splice(index, 1);
    }

    async delete() {
        await fileSystem.rm(this.path, { recursive: true, force: true }, (err) => {
            if (err) {
                console.log(`Error deleting ${this.name}: ${err}.`);
            }
        });
    }

    static fromReference(dbProject) {
        return new Project(dbProject.id, dbProject.name, dbProject.description,
            dbProject.userId, dbProject.path, dbProject.volumeIds);
    }
}