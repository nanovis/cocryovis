export class Model {
    constructor(id, name, description, userId, projectIds = [], checkpointIds = []) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.userId = userId;
        this.projectIds = projectIds;
        this.checkpointIds = checkpointIds;
        Object.preventExtensions(this);
    }

    static fromReference(dbReference) {
        return Object.assign(new this(), dbReference);
    }

    addToProject(projectId) {
        if (this.projectIds.includes(projectId)) {
            throw new Error(`Model ${this.id} (${this.name}): Model is a part of the project.`);
        }
        this.projectIds.push(projectId);
    }

    removedFromProject(projectId) {
        const index = this.projectIds.indexOf(projectId);
        if (index === -1) {
            throw new Error(`Model ${this.id} (${this.name}): Model is not included in the project.`);
        }
        this.projectIds.splice(index, 1);
    }

    addCheckpoint(checkpointId) {
        if (this.checkpointIds.includes(checkpointId)) {
            throw new Error(`Model ${this.id} (${this.name}): Checkpoint is already included in the model.`);
        }
        this.checkpointIds.push(checkpointId);
    }

    removeCheckpoint(checkpointId) {
        const index = this.checkpointIds.indexOf(checkpointId);
        if (index === -1) {
            throw new Error(`Model ${this.id} (${this.name}): Model does not have the checkpoint.`);
        }
        this.checkpointIds.splice(index, 1);
    }

    async delete() {
    }
}