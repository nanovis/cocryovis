import LowdbManager from "../../tools/lowdb-manager.mjs";
import {AbstractModelController} from "../abstract-model-controller.mjs";
import {Model} from "../../models/model.mjs";
import globalEventEmitter from "../../tools/global-event-system.mjs";
import lowdbCheckpointController, {
    checkpointCreatedEvent,
    checkpointDeletedEvent
} from "./lowdb-checkpoint-controller.mjs";

export const modelCreatedEvent = "modelCreated";
export const modelDeletedEvent = "modelDeleted";

class LowdbModelController extends AbstractModelController {
    constructor() {
        super();
        this.db = LowdbManager.db;
        this.models = this.db.data.models;
        Object.preventExtensions(this);

        globalEventEmitter.on(checkpointCreatedEvent, async (checkpoint) => {
            await this.#onCheckpointCreated(checkpoint);
        });
        globalEventEmitter.on(checkpointDeletedEvent, async (checkpoint) => {
            await this.#onCheckpointDeleted(checkpoint);
        });
    }

    #getModelIndex(id) {
        return this.models.findIndex((p) => p.id === id);
    }

    getAllModels() {
        return this.models.map((p) => Model.fromReference(p));
    }

    getById(id) {
        id = Number(id);

        const dbReference = this.models.find((p) => p.id === id);
        return Model.fromReference(dbReference);
    }

    getByIds(ids) {
        const dbReferences = this.models.filter((p) => ids.includes(p.id));
        return dbReferences.map((p) => Model.fromReference(p));
    }

    async create(name, description, userId, projectId) {
        try {
            projectId = Number(projectId);

            let newId = 1;
            if (this.models.length > 0) {
                newId = this.models.at(-1).id + 1;
            }

            const model = new Model(newId, name, description, userId, [projectId]);

            globalEventEmitter.emit(modelCreatedEvent, model);

            // const dbReference = Object.assign({}, model);
            // dbReference.checkpointIds = [];

            await this.db.update(({models}) => models.push(model));
            return model.id;
        }
        catch (error) {
            throw error;
        }
    }

    async update(model) {
        const index = this.#getModelIndex(model.id);
        // const dbReference = this.models[index];
        // Object.assign(dbReference, model);

        await this.db.update(({ models }) => models[index] = model);
        return model;
    }

    async delete(id) {
        id = Number(id);

        const index = this.models.findIndex((p) => p.id === id);

        if (index === -1) {
            throw new Error(`Project ${id} does not exist.`);
        }

        const model = Model.fromReference(this.models[index]);

        globalEventEmitter.emit(modelDeletedEvent, model);

        await model.delete();
        await this.db.update(({ models }) => models.splice(index, 1));
    }

    async onAddedToProject(id, projectId) {
        id = Number(id);
        projectId = Number(projectId);

        const model = this.getById(id);
        model.addToProject(projectId);
        await this.update(model);
    }

    async onRemovedFromProject(id, projectId) {
        id = Number(id);
        projectId = Number(projectId);

        const model = this.getById(id);
        model.removedFromProject(projectId);

        if (model.projectIds.length === 0) {
            await this.delete(model.id);
        }
        else {
            await this.update(model);
        }
    }

    async addCheckpoint(id, checkpointId) {
        id = Number(id);
        checkpointId = Number(checkpointId);

        const model = this.getById(id);
        model.addCheckpoint(checkpointId);
        await lowdbCheckpointController.onAddedToModel(checkpointId, id);
        await this.update(model);
    }

    async removeCheckpoint(id, checkpointId) {
        id = Number(id);
        checkpointId = Number(checkpointId);

        const model = this.getById(id);
        model.removeCheckpoint(checkpointId);
        await lowdbCheckpointController.onRemovedFromModel(checkpointId, id);
        await this.update(model);
    }

    async #onCheckpointCreated(checkpoint) {
        const models = this.getByIds(checkpoint.modelIds);
        for (const model of models) {
            model.addCheckpoint(checkpoint.id);
            await this.update(model);
        }
    }

    async #onCheckpointDeleted(checkpoint) {
        const models = this.getByIds(checkpoint.modelIds);
        for (const model of models) {
            if (model.checkpointIds.includes(checkpoint.id)) {
                model.removeCheckpoint(checkpoint.id);
                await this.update(model);
            }
        }
    }
}

const lowdbModelControllerInstance = LowdbModelController.getInstance();

export default lowdbModelControllerInstance;