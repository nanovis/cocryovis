import LowdbManager from "../../tools/lowdb-manager.mjs";
import globalEventEmitter, {resultDeletedEvent, volumeDeletedEvent} from "../../tools/global-event-system.mjs";
import {AbstractResultController} from "../abstract-result-controller.mjs";
import {Result} from "../../models/result.mjs";
import fileSystem from "fs";

class LowdbResultController extends AbstractResultController {
    constructor() {
        super();
        this.db = LowdbManager.db;
        this.dbData = this.db.data.results;
        Object.preventExtensions(this);

        globalEventEmitter.on(volumeDeletedEvent, async (volume) => {
            await this.#onVolumeDeleted(volume);
        });
    }

    #getIndex(id) {
        return this.dbData.findIndex((p) => p.id === id);
    }

    getById(id) {
        id = Number(id);

        const dbReference = this.dbData.find((p) => p.id === id);

        if (dbReference === undefined) {
            throw new Error(`Volume Data with id ${id} does not exist.`);
        }

        return Result.fromReference(dbReference);
    }

    getByIds(ids) {
        const dbReferences = this.dbData.filter((p) => ids.includes(p.id));
        return dbReferences.map((p) => Result.fromReference(p));
    }

    getResultsVolumesFromVolume(volumeId) {
        const dbReferences = this.dbData.filter((p) => p.volumeIds.includes(volumeId));
        return dbReferences.map((p) => Result.fromReference(p));
    }

    getResultsVolumesFromModel(modelId) {
        const dbReferences = this.dbData.filter((p) => p.modelId === modelId);
        return dbReferences.map((p) => Result.fromReference(p));
    }

    getResultsVolumesFromCheckpoint(checkpointId) {
        const dbReferences = this.dbData.filter((p) => p.checkpointId === checkpointId);
        return dbReferences.map((p) => Result.fromReference(p));
    }

    async create(volumeId, modelId, checkpointId, userId, createFolder = false) {
        volumeId = Number(volumeId);
        modelId = Number(modelId);
        checkpointId = Number(checkpointId);

        let newId = 1;
        if (this.dbData.length > 0) {
            newId = this.dbData.at(-1).id + 1;
        }

        if (!fileSystem.existsSync(this.config.resultsPath)) {
            fileSystem.mkdirSync(this.config.resultsPath, {recursive: true});
        }

        const result =
            await Result.createResult(newId, volumeId, modelId, checkpointId, userId, this.config.resultsPath, createFolder);

        await this.db.update(({results}) => results.push(result));
        return result;
    }

    async update(result) {
        const index = this.#getIndex(result.id);
        await this.db.update(({ results }) => results[index] = result);
        return result;
    }

    async delete(id) {
        id = Number(id);

        const index = this.#getIndex(id);

        if (index === -1) {
            throw new Error(`Project ${id} does not exist.`);
        }

        const result = Result.fromReference(this.checkpoints[index]);

        globalEventEmitter.emit(resultDeletedEvent, result);

        await result.delete();
        await this.db.update(({ results }) => results.splice(index, 1));
    }

    async #onVolumeDeleted(volume) {
        const results = this.getResultsVolumesFromVolume(volume.id);

        for (const result in results) {
            result.removeFromVolume(volume.id);
            if (result.volumeIds.length === 0) {
                await this.delete(result.id);
            }
            else {
                await this.update(result);
            }
        }
    }
}

const lowdbResultControllerInstance = LowdbResultController.getInstance();

export default lowdbResultControllerInstance;