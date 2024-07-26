import {RawData} from "./raw-data.mjs";

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
        return new Volume(dbVolume.name, dbVolume.description, dbVolume.path, rawData, dbVolume.sparseLabels, dbVolume.pseudoLabels, dbVolume.id);
    }
}