export class Volume {
    constructor(name, description, path = "", rawData = null, sparseLabels = [], pseudoLabels = [], id = -1) {
        this.name = name;
        this.description = description;
        this.id = id;
        this.path = path;
        this.rawData = rawData;
        this.sparseLabels = sparseLabels;
        this.pseudoLabels = pseudoLabels;
    }

    static fromReference(dbVolume) {
        return new Volume(dbVolume.name, dbVolume.description, dbVolume.path, dbVolume.rawData, dbVolume.sparseLabels, dbVolume.pseudoLabels, dbVolume.id);
    }

    addRawData(name) {
        this.rawData.name = name;
    }

    addSparseLabels(name, id) {
        this.sparseLabels.push({name: name, id: id});
    }
}