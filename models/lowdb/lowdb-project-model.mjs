import { IProjectModel } from "../i-project-model.mjs";
import {Project} from "../project.mjs";
import {Volume} from "../volume.mjs";
import LowdbManager from "../../tools/lowdb-manager.mjs";
import path from "path";
import {SparseLabeledVolume} from "../sparse-labeled-volume.mjs";
import {PseudoLabeledVolume} from "../pseudo-labeled-volume.mjs";
import {Model} from "../model.mjs";

export class LowdbProjectModel extends IProjectModel {
    constructor(config) {
        super(config);
        this.db = LowdbManager.db;
        this.projects = this.db.data.projects;
        Object.preventExtensions(this);
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

    async create(project) {
        if (this.projects.length === 0) {
            project.id = 1;
        } else {
            project.id = this.projects.at(-1).id + 1;
        }

        try {
            this.createProjectDirectory(project);
        }
        catch (error) {
            throw error;
        }

        await this.db.update(({projects}) => projects.push(project))
        return project.id;
    }

    async update(id, project) {
        id = Number(id);
        const projectIndex = this.projects.findIndex((p) => p.id === id);

        await this.db.update(({ projects }) => projects[projectIndex] = project);
        return project;
    }

    async delete(id) {
        id = Number(id);

        const project = this.getById(id);
        this.removeProjectDirectory(project);
        await this.projects.remove({ id }).write();
    }

    getVolume(projectId, volumeId) {
        return super.getVolume(Number(projectId), Number(volumeId));
    }

    async addVolume(projectId, name, description){
        projectId = Number(projectId);

        const volume = Volume.createVolume(name, description);
        const project = this.getById(projectId);

        if (!Object.hasOwn(project, 'volumes')) {
            project.volumes = []
        }

        if (project.volumes.length === 0) {
            volume.id = 1;
        } else {
            volume.id = project.volumes.at(-1).id + 1;
        }

        try {
            this.createVolumeDirectory(project, volume)
        }
        catch (error) {
            throw error;
        }

        project.volumes.push(volume);

        await this.update(projectId, project);
        return volume.id;
    }

    async removeVolume(projectId, volumeId){
        await super.removeVolume(Number(projectId), Number(volumeId));
    }

    getRawVolume(projectId, volumeId) {
        return super.getRawVolume(Number(projectId), Number(volumeId));
    }

    async addRawVolume(projectId, volumeId, file) {
        return await super.addRawVolume(Number(projectId), Number(volumeId), file);
    }

    async removeRawVolume(projectId, volumeId) {
        await super.removeRawVolume(Number(projectId), Number(volumeId));
    }

    getSparseLabeledVolume(projectId, volumeId, sparseLabeledVolumeId) {
        return super.getSparseLabeledVolume(Number(projectId), Number(volumeId), Number(sparseLabeledVolumeId));
    }

    async addSparseLabeledVolumes(projectId, volumeId, files) {
        projectId = Number(projectId);
        volumeId = Number(volumeId);
        const project = this.getById(projectId);
        const volume = project.findVolume(volumeId);

        let sparseLebeledVolumes = [];
        let nextId = 1;
        if (volume.sparseLabels.length > 0) {
            nextId = volume.sparseLabels.at(-1).id + 1;
        }

        try {
            const {fileNames, filePaths} = await this.saveData(files,
                path.join(volume.path, this.volumeSubfolders.sparseLabels), [".raw"], false);
            for (let i = 0; i < fileNames.length; i++) {
                const newSparseLabeledVolume = SparseLabeledVolume
                    .createSparseLabeledVolume(fileNames[i], filePaths[i]);
                newSparseLabeledVolume.id = nextId;
                nextId++;
                sparseLebeledVolumes.push(newSparseLabeledVolume);
            }
        }
        catch (error) {
            throw error;
        }

        if (sparseLebeledVolumes.length === 0) {
            throw new Error(`No valid files found.`);
        }
        volume.sparseLabels.push(...sparseLebeledVolumes);
        await this.update(projectId, project);
        console.log("Sparse Labeled Volumes successfully uploaded.");
    }

    async removeSparseLabeledVolume(projectId, volumeId, sparseLabeledVolumeId) {
        await super.removeSparseLabeledVolume(Number(projectId), Number(volumeId), Number(sparseLabeledVolumeId));
    }

    getPseudoLabeledVolume(projectId, volumeId, pseudoLabeledVolumeId) {
        return super.getPseudoLabeledVolume(Number(projectId), Number(volumeId), Number(pseudoLabeledVolumeId));
    }

    async addPseudoLabeledVolumes(projectId, volumeId, files) {
        projectId = Number(projectId);
        volumeId = Number(volumeId);
        const project = this.getById(projectId);
        const volume = project.findVolume(volumeId);

        let pseudoLabeledVolumes = [];
        let nextId = 1;
        if (volume.pseudoLabels.length > 0) {
            nextId = volume.pseudoLabels.at(-1).id + 1;
        }

        try {
            const {fileNames, filePaths} = await this.saveData(files,
                path.join(volume.path, this.volumeSubfolders.pseudoLabels), [".raw"], false);
            for (let i = 0; i < fileNames.length; i++) {
                const newPseudoLabeledVolume = PseudoLabeledVolume
                    .createPseudoLabeledVolume(fileNames[i], filePaths[i]);
                newPseudoLabeledVolume.id = nextId;
                nextId++;
                pseudoLabeledVolumes.push(newPseudoLabeledVolume);
            }
        }
        catch (error) {
            throw error;
        }

        if (pseudoLabeledVolumes.length === 0) {
            throw new Error(`No valid files found.`);
        }
        volume.pseudoLabels.push(...pseudoLabeledVolumes);
        await this.update(projectId, project);
        console.log("Pseudo Labeled Volumes successfully uploaded.");
    }

    async removePseudoLabeledVolume(projectId, volumeId, pseudoLabeledVolumeId) {
        await super.removePseudoLabeledVolume(Number(projectId), Number(volumeId), Number(pseudoLabeledVolumeId));
    }

    getModel(projectId, modelId) {
        return super.getModel(Number(projectId), Number(modelId));
    }

    async addModel(projectId, name, description) {
        projectId = Number(projectId);

        const model = Model.createModel(name, description);
        const project = this.getById(projectId);

        if (!Object.hasOwn(project, 'models')) {
            project.models = []
        }

        if (project.models.length === 0) {
            model.id = 1;
        } else {
            model.id = project.models.at(-1).id + 1;
        }

        try {
            this.createModelDirectory(project, model)
        }
        catch (error) {
            throw error;
        }

        project.models.push(model);

        await this.update(projectId, project);
        return model.id;
    }

    async removeModel(projectId, modelId) {
        await super.removeModel(Number(projectId), Number(modelId));
    }
}