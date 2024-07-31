import {RawData} from "./raw-data.mjs";
import {SparseLabeledVolume} from "./sparse-labeled-volume.mjs";
import {PseudoLabeledVolume} from "./pseudo-labeled-volume.mjs";
import {fileNameFilter} from "../tools/utils.mjs";
import path from "path";
import fileSystem from "fs";

export class Volume {
    static subfolders = {
        rawData: 'raw-data',
        sparseLabels: 'sparse-labels',
        pseudoLabels: 'pseudo-labels',
    };

    constructor(id, name, description, userId, path = "", rawData = null, sparseLabeledVolume = null,
                pseudoLabeledVolume = null, projectIds = []) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.userId = userId;
        this.path = path;
        this.rawData = rawData;
        this.sparseLabeledVolume = sparseLabeledVolume;
        this.pseudoLabeledVolume = pseudoLabeledVolume;
        this.projectIds = projectIds;
        Object.preventExtensions(this);
    }

    static createVolume(id, name, description, userId, projectId, basePath) {
        const volume = new Volume(id, name, description, userId);
        volume.addProject(projectId);
        volume.createDirectory(basePath);
        return volume;
    }

    createDirectory(basePath) {
        const volumeFolder = this.id + "_" + fileNameFilter(this.name);
        const volumePath = path.join(basePath, volumeFolder);
        this.path = volumePath;
        if (fileSystem.existsSync(volumePath)) {
            throw new Error(`Volume directory already exists`);
        }
        fileSystem.mkdirSync(volumePath, {recursive: true});

        for (const subfolder in Volume.subfolders) {
            fileSystem.mkdirSync(path.join(volumePath, Volume.subfolders[subfolder]));
        }
    }

    async delete() {
        if (this.rawData) {
            await this.rawData.delete();
        }
        if (this.sparseLabeledVolume) {
            await this.sparseLabeledVolume.delete();
        }
        if (this.pseudoLabeledVolume) {
            await this.pseudoLabeledVolume.delete();
        }
        await fileSystem.rm(this.path, { recursive: true, force: true }, (err) => {
            if (err) {
                console.log(`Error deleting ${this.name}: ${err}.`);
            }
        });
    }

    static fromReference(dbVolume) {
        let rawData = null;
        if (dbVolume.rawData != null) {
            rawData = RawData.fromReference(dbVolume.rawData);
        }

        let sparseLabeledVolume = null;
        if (dbVolume.sparseLabeledVolume != null) {
            sparseLabeledVolume = SparseLabeledVolume.fromReference(dbVolume.sparseLabeledVolume);
        }

        let pseudoLabeledVolume = null;
        if (dbVolume.pseudoLabeledVolume != null) {
            pseudoLabeledVolume = PseudoLabeledVolume.fromReference(dbVolume.pseudoLabeledVolume);
        }

        return new Volume(dbVolume.id, dbVolume.name, dbVolume.description, dbVolume.userId,
            dbVolume.path, rawData, sparseLabeledVolume, pseudoLabeledVolume);
    }

    addProject(projectId) {
        if (!this.projectIds.includes(projectId)) {
            this.projectIds.push(projectId);
        }
    }

    removeProject(projectId) {
        const index = this.projectIds.indexOf(projectId);
        this.projectIds.splice(index, 1);
    }

    async addRawData(file) {
        try {
            this.rawData = await RawData.createRawData(file, path.join(this.path, Volume.subfolders.rawData));
        }
        catch (error) {
            throw error;
        }
    }

    async removeRawData() {
        if(!this.rawData) {
            throw new Error(`Volume ${this.name} has no raw data.`);
        }
        try {
            this.rawData.delete();
            this.rawData = null;
        }
        catch (error) {
            throw error;
        }
    }

    async addSparseLabeledVolume(file) {
        this.sparseLabeledVolume = await SparseLabeledVolume.createSparseLabeledVolume(
            file, path.join(this.path, Volume.subfolders.sparseLabels));
    }

    async removeSparseLabeledVolume() {
        if(!this.sparseLabeledVolume) {
            throw new Error(`Volume ${this.name} has no pseudo labels.`);
        }

        try {
            this.sparseLabeledVolume.delete();
            this.sparseLabeledVolume = null;
        }
        catch (error) {
            throw error;
        }
    }

    async addPseudoLabeledVolume(file) {
        this.pseudoLabeledVolume = await PseudoLabeledVolume.createPseudoLabeledVolume(
            file, path.join(this.path, Volume.subfolders.pseudoLabels));
    }

    async removePseudoLabeledVolume() {
        if(!this.pseudoLabeledVolume) {
            throw new Error(`Volume ${this.name} has no pseudo labels.`);
        }

        try {
            this.pseudoLabeledVolume.delete();
            this.pseudoLabeledVolume = null;
        }
        catch (error) {
            throw error;
        }
    }
}