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
        return new Volume(dbVolume.name, dbVolume.description, dbVolume.path, dbVolume.rawData, dbVolume.sparseLabels, dbVolume.pseudoLabels, dbVolume.id);
    }
}