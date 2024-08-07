export class ModelView {
    constructor(model) {
        this.id = model.id;
        this.name = model.name;
        this.description = model.description;
        this.userId = model.userId;
        this.checkpoints = [];
        Object.preventExtensions(this);
    }
}