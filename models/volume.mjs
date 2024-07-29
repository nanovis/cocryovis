import {RawData} from "./raw-data.mjs";
import {SparseLabeledVolume} from "./sparse-labeled-volume.mjs";
import {PseudoLabeledVolume} from "./pseudo-labeled-volume.mjs";

export class Volume {
    constructor(name, description, path = "", rawData = null, sparseLabels = [], pseudoLabels = [], id = -1) {
        this.name = name;
        this.description = description;
        this.id = id;
        this.path = path;
        this.rawData = rawData;
        this.sparseLabels = sparseLabels;
        this.pseudoLabels = pseudoLabels;
        Object.preventExtensions(this);
    }

    static createVolume(name, description) {
        return new Volume(name, description);
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

        return new Volume(dbVolume.name, dbVolume.description, dbVolume.path, rawData, sparseLabels, pseudoLabels, dbVolume.id);
    }

    findSparseLabel(id) {
        return this.sparseLabels.find(s => s.id === id);
    }

    removeSparseLabel(id) {
        const index = this.sparseLabels.findIndex(s => s.id === id);
        this.sparseLabels.splice(index, 1);
    }

    findPseudoLabel(id) {
        return this.pseudoLabels.find(p => p.id === id);
    }

    removePseudoLabel(id) {
        const index = this.pseudoLabels.findIndex(p => p.id === id);
        this.pseudoLabels.splice(index, 1);
    }
}