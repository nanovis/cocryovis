import {RawData} from "./raw-data.mjs";
import {SparseLabeledVolume} from "./sparse-labeled-volume.mjs";
import {PseudoLabeledVolume} from "./pseudo-labeled-volume.mjs";
import {fileNameFilter} from "../tools/utils.mjs";
import path from "path";
import fileSystem from "fs";

export class Volume {
    subfolders = {
        rawData: 'raw-data',
        sparseLabels: 'sparse-labels',
        pseudoLabels: 'pseudo-labels',
    };

    constructor(id, name, description, path = "", rawData = null, sparseLabels = [], pseudoLabels = []) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.path = path;
        this.rawData = rawData;
        this.sparseLabels = sparseLabels;
        this.pseudoLabels = pseudoLabels;
        Object.preventExtensions(this);
    }

    static createVolume(id, name, description, basePath) {
        const volume = new Volume(id, name, description);
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

        for (const subfolder in this.subfolders) {
            fileSystem.mkdirSync(path.join(volumePath, this.subfolders[subfolder]));
        }
    }

    async delete() {
        if (this.rawData) {
            await this.rawData.delete();
        }
        if (this.sparseLabels) {
            for (const sparseLabel of this.sparseLabels) {
                await sparseLabel.delete();
            }
        }
        if (this.pseudoLabels) {
            for (const pseudoLabel of this.pseudoLabels) {
                await pseudoLabel.delete();
            }
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

        const sparseLabels = [];
        for (const sparseLabel of dbVolume.sparseLabels) {
            sparseLabels.push(SparseLabeledVolume.fromReference(sparseLabel));
        }

        const pseudoLabels = [];
        for (const pseudoLabel of dbVolume.pseudoLabels) {
            pseudoLabels.push(PseudoLabeledVolume.fromReference(pseudoLabel));
        }

        return new Volume(dbVolume.id, dbVolume.name, dbVolume.description,
            dbVolume.path, rawData, sparseLabels, pseudoLabels);
    }

    async addRawData(file) {
        try {
            this.rawData = await RawData.createRawData(file, path.join(this.path, this.subfolders.rawData));
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

    findSparseLabel(id) {
        return this.sparseLabels.find(s => s.id === id);
    }

    addSparseLabel(sparseLabel) {
        this.sparseLabels.push(sparseLabel);
    }

    async removeSparseLabel(id) {
        const index = this.sparseLabels.findIndex(s => s.id === id);

        if (index === -1) {
            throw new Error(`Sparse labeled volume ${id} does not exist in volume ${this.name}.`);
        }

        const label = this.sparseLabels[index];
        this.sparseLabels.splice(index, 1);
        await label.delete();
    }

    findPseudoLabel(id) {
        return this.pseudoLabels.find(p => p.id === id);
    }

    addPseudoLabel(pseudoLabel) {
        this.pseudoLabels.push(pseudoLabel);
    }

    async removePseudoLabel(id) {
        const index = this.pseudoLabels.findIndex(p => p.id === id);

        if (index === -1) {
            throw new Error(`Pseudo labeled volume ${id} does not exist in volume ${this.name}.`);
        }

        const label = this.pseudoLabels[index];
        this.pseudoLabels.splice(index, 1);
        await label.delete();
    }
}