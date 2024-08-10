import LowdbManager from "../../tools/lowdb-manager.mjs";
import globalEventEmitter from "../../tools/global-event-system.mjs";
import {AbstractVolumeDataController} from "../abstract-volume-data-controller.mjs";
import {VolumeData} from "../../models/volume-data.mjs";

export const volumeDataDeletedEvent = "volumeDataDeleted";

class LowdbVolumeDataController extends AbstractVolumeDataController {
    constructor() {
        super();
        this.db = LowdbManager.db;
        this.dbData = this.db.data.volumeData;
        Object.preventExtensions(this);
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

        return VolumeData.fromReference(dbReference);
    }

    getByIds(ids) {
        const dbReferences = this.dbData.filter((p) => ids.includes(p.id));
        return dbReferences.map((p) => VolumeData.fromReference(p));
    }

    getSparseLabeledVolumesFromVolume(volumeId) {
        const dbReferences = this.dbData.filter((p) =>
            p.type === VolumeData.volumeTypes.sparseLabels && p.volumeIds.includes(volumeId));
        return dbReferences.map((p) => VolumeData.fromReference(p));
    }

    getPseudoLabeledVolumesFromVolume(volumeId) {
        const dbReferences = this.dbData.filter((p) =>
            p.type === VolumeData.volumeTypes.pseudoLabels && p.volumeIds.includes(volumeId));
        return dbReferences.map((p) => VolumeData.fromReference(p));
    }

    async create(type, volumeId, userId) {
        try {
            volumeId = Number(volumeId);

            let newId = 1;
            if (this.dbData.length > 0) {
                newId = this.dbData.at(-1).id + 1;
            }

            console.log(`Creating new volume data object with id ${newId}.`)

            const volumeDataObj = await VolumeData.createVolumeData(newId, type, userId, volumeId, this.config.volumeDataPath);

            await this.db.update(({volumeData}) => volumeData.push(volumeDataObj));
            return volumeDataObj.id;
        }
        catch (error) {
            throw error;
        }
    }

    async update(volumeDataObj) {
        const index = this.#getIndex(volumeDataObj.id);
        await this.db.update(({ volumeData }) => volumeData[index] = volumeDataObj);
        return volumeDataObj;
    }

    async delete(id) {
        id = Number(id);

        const index = this.#getIndex(id);

        if (index === -1) {
            throw new Error(`Project ${id} does not exist.`);
        }

        const volumeDataObj = VolumeData.fromReference(this.checkpoints[index]);

        globalEventEmitter.emit(volumeDataDeletedEvent, volumeDataObj);

        await volumeDataObj.delete();
        await this.db.update(({ volumeData }) => volumeData.splice(index, 1));
    }

    async onAddedToVolume(id, volumeId) {
        id = Number(id);
        volumeId = Number(volumeId);

        const volumeDataObj = this.getById(id);
        volumeDataObj.addToVolume(volumeId);
        await this.update(volumeDataObj);
    }

    async onRemovedFromVolume(id, volumeId) {
        id = Number(id);
        volumeId = Number(volumeId);

        const volumeDataObj = this.getById(id);
        volumeDataObj.removeFromVolume(volumeId);

        if (volumeDataObj.volumeIds.length === 0) {
            await this.delete(volumeDataObj.id);
        }
        else {
            await this.update(volumeDataObj);
        }
    }

    async addFiles(id, files) {
        await super.addFiles(Number(id), files);
    }

    async removeRawFile(id) {
        await super.removeRawFile(Number(id));
    }

    async removeSettingsFile(id) {
        await super.removeSettingsFile(Number(id));
    }
}

const lowdbVolumeDataControllerInstance = LowdbVolumeDataController.getInstance();

export default lowdbVolumeDataControllerInstance;