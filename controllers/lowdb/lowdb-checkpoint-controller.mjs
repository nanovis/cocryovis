import LowdbManager from "../../tools/lowdb-manager.mjs";
import globalEventEmitter from "../../tools/global-event-system.mjs";
import {AbstractCheckpointController} from "../abstract-checkpoint-controller.mjs";
import {Checkpoint} from "../../models/checkpoint.mjs";
import {Model} from "../../models/model.mjs";

export const checkpointCreatedEvent = "checkpointCreated";
export const checkpointDeletedEvent = "checkpointDeleted";

class LowdbCheckpointController extends AbstractCheckpointController {
    constructor() {
        super();
        this.db = LowdbManager.db;
        this.checkpoints = this.db.data.checkpoints;
        Object.preventExtensions(this);
    }

    #getIndex(id) {
        return this.checkpoints.findIndex((p) => p.id === id);
    }

    getById(id) {
        id = Number(id);

        const dbReference = this.checkpoints.find((p) => p.id === id);
        return Checkpoint.fromReference(dbReference);
    }

    getByIds(ids) {
        const dbReferences = this.checkpoints.filter((p) => ids.includes(p.id));
        return dbReferences.map((p) => Checkpoint.fromReference(p));
    }

    getCheckpointsFromModel(projectId) {
        projectId = Number(projectId);

        const dbReferences = this.checkpoints.filter((p) => p.modelIds.includes(projectId));
        return dbReferences.map((p) => Checkpoint.fromReference(p));
    }

    async create(file, modelId, userId) {
        try {
            modelId = Number(modelId);
            userId = Number(userId);

            let newId = 1;
            if (this.checkpoints.length > 0) {
                newId = this.checkpoints.at(-1).id + 1;
            }

            console.log(`Creating new checkpoint with id ${newId} for model ${modelId}.`)

            const checkpoint = await Checkpoint.fromFile(file, this.config.checkpointsPath, newId, userId, modelId);

            globalEventEmitter.emit(checkpointCreatedEvent, checkpoint);

            await this.db.update(({checkpoints}) => checkpoints.push(checkpoint));
            return checkpoint.id;
        }
        catch (error) {
            throw error;
        }
    }

    async update(checkpoint) {
        const index = this.#getIndex(checkpoint.id);
        await this.db.update(({ checkpointss }) => checkpoints[index] = checkpoint);
        return checkpoint;
    }

    async delete(id) {
        id = Number(id);

        const index = this.#getIndex(id);

        if (index === -1) {
            throw new Error(`Project ${id} does not exist.`);
        }

        const checkpoint = Checkpoint.fromReference(this.checkpoints[index]);

        globalEventEmitter.emit(checkpointDeletedEvent, checkpoint);

        await checkpoint.delete();
        await this.db.update(({ checkpoints }) => checkpoints.splice(index, 1));
    }

    async onAddedToModel(id, modelId) {
        id = Number(id);
        modelId = Number(modelId);

        const checkpoint = this.getById(id);
        checkpoint.addToModel(modelId);
        await this.update(checkpoint);
    }

    async onRemovedFromModel(id, modelId) {
        id = Number(id);
        modelId = Number(modelId);

        const checkpoint = this.getById(id);
        checkpoint.removeFromModel(modelId);

        if (checkpoint.modelIds.length === 0) {
            await this.delete(checkpoint.id);
        }
        else {
            await this.update(checkpoint);
        }
    }
}

const lowdbCheckpointControllerInstance = LowdbCheckpointController.getInstance();

export default lowdbCheckpointControllerInstance;