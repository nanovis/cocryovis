export class Model {
    constructor(name, description, path, checkpoints, inferenceData, predictions, id) {
        this.name = name;
        this.description = description;
        this.path = path;
        this.checkpoints = checkpoints;
        this.inferenceData = inferenceData;
        this.predictions = predictions;
        this.id = id;
        Object.preventExtensions(this);
    }

    static createModel(name, description) {
        return new Model(name, description);
    }

    static fromReference(dbModel) {
        return new Model(dbModel.name, dbModel.description, dbModel.path, dbModel.checkpoints,
            dbModel.inferenceData, dbModel.predictions, dbModel.id);
    }
}