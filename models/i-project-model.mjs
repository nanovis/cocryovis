import fileSystem from "fs";
import {fileNameFilter} from "../tools/utils.mjs";
import path from "path";
import AdmZip from "adm-zip";
import {RawData} from "./raw-data.mjs";

export class IProjectModel {
    constructor(config) {
        if(this.constructor === IProjectModel) {
            throw new Error("Class is of abstract type and can't be instantiated");
        }
        this.config = config;
        if (this.config === undefined) {
            throw new Error("Missing projects config");
        }
    }

    subfolders = {
        volumes: 'volumes',
    };

    volumeSubfolders = {
        rawData: 'raw-data',
        sparseLabels: 'sparse-labels',
        ilastikLabels: 'ilastik-labels',
    };

    getUserProjects(userId) {
        throw new Error('Method not implemented');
    }

    getById(id) {
        throw new Error('Method not implemented');
    }

    async create(project) {
        throw new Error('Method not implemented');
    }

    async update(id, project) {
        throw new Error('Method not implemented');
    }

    async delete(id) {
        throw new Error('Method not implemented');
    }

    createProjectDirectory(project) {
        const projectFolder = project.id + "_" + fileNameFilter(project.name);
        let projectPath = path.join(this.config.path, projectFolder)
        project.path = projectPath;
        if (fileSystem.existsSync(projectPath)) {
            throw new Error(`Project directory already exists`);
        }
        fileSystem.mkdirSync(projectPath, { recursive: true });

        for (const subfolder in this.subfolders) {
            fileSystem.mkdirSync(path.join(projectPath, this.subfolders[subfolder]));
        }
    }

    removeProjectDirectory(project) {
        fileSystem.rm(project.path, { recursive: true, force: true }, (err) => {
            if (err) {
                console.log(`Error deleting ${project.name}: ${err}.`);
            }
        });
    }

    getVolume(projectId, volumeId) {
        return this.getById(projectId).findVolume(volumeId);
    }

    async addVolume(projectId, name, description){
        throw new Error('Method not implemented');
    }

    createVolumeDirectory(project, volume) {
        const volumeFolder = volume.id + "_" + fileNameFilter(volume.name);
        const volumePath = path.join(this.config.path, project.path, this.subfolders.volumes, volumeFolder);
        volume.path = volumePath;
        if (fileSystem.existsSync(volumePath)) {
            throw new Error(`Volume directory already exists`);
        }
        fileSystem.mkdirSync(volumePath, {recursive: true});

        for (const subfolder in this.volumeSubfolders) {
            fileSystem.mkdirSync(path.join(volumePath, this.volumeSubfolders[subfolder]));
        }
    }

    async removeVolume(projectId, volumeId){
        const project = this.getById(projectId);
        const volume = project.findVolume(volumeId);

        if (volume === undefined){
            throw new Error(`Volume does not exists`);
        }

        try {
            this.removeVolumeDirectory(volume);
        }
        catch (error) {
            throw error;
        }

        project.removeVolume(volume.id);

        await this.update(projectId, project);
        console.log(`Volume ${volume.name} (Id: ${volume.id}) successfully deleted.`);
    }

    removeVolumeDirectory(volume) {
        fileSystem.rm(volume.path, { recursive: true, force: true }, (err) => {
            if (err) {
                console.log(`Error deleting ${volume.name}: ${err}.`);
            }
        });
    }

    getRawVolume(projectId, volumeId) {
        return this.getById(projectId).findVolume(volumeId).rawData;
    }

    async addRawVolume(projectId, volumeId, file) {
        if (Array.isArray(file)) {
            throw new Error(`Raw data has to consist of a single file only.`);
        }
        const project = this.getById(projectId);
        const volume = project.findVolume(volumeId);

        let rawData = null;

        try {
            const [name, path] = await this.saveRawVolumeData(volume, file);
            rawData = new RawData(name, path);
        }
        catch (error) {
            throw error;
        }

        if (rawData == null) {
            throw new Error(`No valid raw file found.`);
        }
        volume.rawData = rawData;
        await this.update(projectId, project);
        console.log("Raw Data successfully uploaded.");
    }

    async saveRawVolumeData(volume, file) {
        const uploadPath = path.join(volume.path, this.volumeSubfolders.rawData);
        let rawDataFileName;
        let rawDataPath;

        if (!fileSystem.existsSync(uploadPath)) {
            fileSystem.mkdirSync(uploadPath, { recursive: true });
        }

        if (file.name.endsWith('.zip')) {
            let zip = new AdmZip(file.data);
            const zipEntries = zip.getEntries();
            for (const entry of zipEntries) {
                if (entry.name.endsWith('.raw')) {
                    const filteredFileName = fileNameFilter(entry.name);
                    zip.extractEntryTo(entry, uploadPath, false, true, false, filteredFileName);
                    rawDataFileName = filteredFileName;
                    rawDataPath = path.join(uploadPath, filteredFileName);
                    break;
                }
            }
        } else {
            const filteredFileName = fileNameFilter(file.name);
            const rawPath = path.join(uploadPath, filteredFileName);
            await file.mv(rawPath);
            rawDataFileName = filteredFileName;
            rawDataPath = rawPath;
        }

        return [rawDataFileName, rawDataPath];
    }

    async removeRawVolume(projectId, volumeId) {
        const project = this.getById(projectId);
        const volume = project.findVolume(volumeId);

        if(!volume.rawData) {
            throw new Error(`Volume ${volume.name} has no raw data.`);
        }

        await this.removeRawVolumeData(volume);

        volume.rawData = null;
        await this.update(projectId, project);
        console.log("Raw Data successfully deleted.");
    }

    async removeRawVolumeData(volume) {
        await fileSystem.rm(volume.rawData.path, { recursive: true, force: true }, (err) => {
            if (err) {
                console.log(`Error deleting ${volume.rawData.name}: ${err}.`);
            }
        });
    }

    prepareDataForDownload(downloadable) {
        const zip = new AdmZip();
        zip.addLocalFile(downloadable.path);
        const outputFileName = path.parse(downloadable.path).name;
        return {
            name: `${outputFileName}.zip`,
            zipBuffer: zip.toBuffer()
        };
    }
}