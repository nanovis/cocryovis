import { Project } from "./project.mjs";
import fileSystem from "fs";
import path from 'path';
import {Volume} from "./volume.mjs";
import AdmZip from "adm-zip";
import {fileNameFilter} from "./utils.mjs";

export class ProjectHandler {
    constructor(db, config) {
        this.db = db;
        this.config = config;
    }

    subfolders = {
        volumes: 'volumes',
    };

    volumeSubfolders = {
        rawData: 'raw-data',
        sparseLabels: 'sparse-labels',
        ilastikLabels: 'ilastik-labels',
    };

    async addNewProject(name, description, userId) {
        if (!fileSystem.existsSync(this.config.path)) {
            fileSystem.mkdirSync(this.config.path);
            console.log('Created projects directory');
        }

        const project = new Project(name, description, userId);

        const projects = this.db.data.projects;
        if (projects.length === 0) {
            project.id = 1;
        } else {
            project.id = projects.at(-1).id + 1;
        }

        const projectFolder = project.id + "_" + fileNameFilter(project.name);
        project.path = projectFolder;
        let projectPath = path.join(this.config.path, projectFolder)
        if (fileSystem.existsSync(projectPath)) {
            throw new Error(`Project directory already exists`);
        }
        fileSystem.mkdirSync(projectPath);

        for (const subfolder in this.subfolders) {
            fileSystem.mkdirSync(path.join(projectPath, this.subfolders[subfolder]));
        }

        // this.projects.push(project);
        await this.db.update(({ projects }) => projects.push(project))
        return project.id;
    }

    findProject(id) {
        const projectReference = this.db.data.projects.find((p) => p.id === id);
        return Project.fromReference(projectReference);
    }

    findProjectIndex(id) {
        return this.db.data.projects.findIndex((p) => p.id === id);
    }

    getProjectFromIndex(index) {
        return Project.fromReference(this.db.data.projects[index]);
    }

    projectsFromUser(userId) {
        const projectReferences = this.db.data.projects.filter((p) => p.userId = userId)
        return projectReferences.map((p) => Project.fromReference(p));
    }

    async deleteProject(id) {
        try {
            const projectIndex = this.findProjectIndex(id);
            fileSystem.rm(modelPath, { recursive: true, force: true }, (err) => {
                if (err) {
                    console.log("Error deleting model folders.");
                    console.log(err);
                }
            });
            await this.db.update(({ projects }) => projects.splice(projectIndex, 1))
            console.log("Project successfully deleted.");
        } catch (err) {
            console.error("Error deleting project.");
        }
    }

    async addNewVolume(projectId, name, description){
        const projectIndex = this.findProjectIndex(projectId);
        const project = this.db.data.projects[projectIndex];

        const volume = new Volume(name, description);

        if (!Object.hasOwn(project, 'volumes')) {
            project.volumes = []
        }

        if (project.volumes.length === 0) {
            volume.id = 1;
        } else {
            volume.id = project.volumes.at(-1).id + 1;
        }

        const volumeFolder = volume.id + "_" + fileNameFilter(volume.name);
        volume.path = volumeFolder;
        const volumePath = path.join(this.config.path, project.path, this.subfolders.volumes, volumeFolder);

        if (fileSystem.existsSync(volumePath)) {
            throw new Error(`Volume directory already exists`);
        }
        fileSystem.mkdirSync(volumePath, {recursive: true});

        for (const subfolder in this.volumeSubfolders) {
            fileSystem.mkdirSync(path.join(volumePath, this.volumeSubfolders[subfolder]));
        }

        project.volumes.push(volume);

        await this.db.update(({ projects }) => projects[projectIndex] = project)
        return volume.id;
    }

    async removeVolume(projectId, volumeId){
        const projectIndex = this.findProjectIndex(projectId);
        const project = this.getProjectFromIndex(projectIndex);
        const volumeIndex = project.findVolumeIndex(volumeId);
        const volume = project.getVolumeFromIndex(volumeIndex);
        if (volume === undefined){
            throw new Error(`Volume does not exists`);
        }

        const volumePath = path.join(this.config.path, project.path, this.subfolders.volumes, volume.path);
        await fileSystem.rm(volumePath, { recursive: true, force: true }, (err) => {
            if (err) {
                console.log(`Error deleting ${volume.name}: ${err}.`);
            }
        });

        project.volumes.splice(volumeIndex, 1);

        await this.db.update(({ projects }) => projects[projectIndex] = project)
        console.log(`Volume ${volume.name} (Id: ${volume.id}) successfully deleted.`);
    }

    async uploadRawVolumeData(projectId, volumeId, file) {
        if (Array.isArray(file)) {
            throw new Error(`Raw data has to consist of a single file only.`);
        }
        const projectIndex = this.findProjectIndex(projectId);
        const project = this.getProjectFromIndex(projectIndex);
        const volume = project.findVolume(volumeId);
        const uploadPath = path.join(this.config.path, project.path, this.subfolders.volumes, volume.path, this.volumeSubfolders.rawData);
        const data = {};
        if (file.name.endsWith('.zip')) {
            let zip = new AdmZip(file.data);
            const zipEntries = zip.getEntries();
            for (const entry of zipEntries) {
                if (entry.name.endsWith('.raw')) {
                    const filteredFileName = fileNameFilter(entry.name);
                    zip.extractEntryTo(entry, uploadPath, false, true, false, filteredFileName);
                    data.name = filteredFileName;
                    break;
                }
            }
        } else {
            const filteredFileName = fileNameFilter(file.name);
            const rawPath = path.join(uploadPath, filteredFileName);
            await file.mv(rawPath);
            data.name = filteredFileName;
        }

        if (!Object.hasOwn(data, 'name')) {
            throw new Error(`No valid raw file found.`);
        }
        volume.rawData = data;
        await this.db.update(({ projects }) => projects[projectIndex] = project);
        console.log("Raw Data successfully uploaded.");
    }

    async deleteRawVolumeData(projectId, volumeId) {
        const projectIndex = this.findProjectIndex(projectId);
        const project = this.getProjectFromIndex(projectIndex);
        const volume = project.findVolume(volumeId);

        if(!volume.rawData) {
            throw new Error(`Volume ${volume.name} has no raw data.`);
        }

        const dataPath = path.join(this.config.path, project.path, this.subfolders.volumes, volume.path, this.volumeSubfolders.rawData, volume.rawData.name);
        await fileSystem.rm(dataPath, { recursive: true, force: true }, (err) => {
            if (err) {
                console.log(`Error deleting ${volume.rawData.name}: ${err}.`);
            }
        });
        volume.rawData = null;
        await this.db.update(({ projects }) => projects[projectIndex] = project);
        console.log("Raw Data successfully deleted.");
    }
}