import {Volume} from "../../models/volume.mjs";
import LowdbManager from "../../tools/lowdb-manager.mjs";
import {AbstractVolumeController} from "../abstract-volume-controller.mjs";
import globalEventEmitter from "../../tools/global-event-system.mjs";

class LowdbVolumeController extends AbstractVolumeController {
    constructor() {
        super();
        this.db = LowdbManager.db;
        this.volumes = this.db.data.volumes;
        Object.preventExtensions(this);
    }

    getAllVolumes() {
        return this.volumes.map((v) => Volume.fromReference(v));
    }

    getById(id) {
        id = Number(id);

        const dbReference = this.volumes.find((v) => v.id === id);
        return Volume.fromReference(dbReference);
    }

    getByIds(ids) {
        const dbReferences = this.volumes.filter((v) => ids.includes(v.id));
        return dbReferences.map((v) => Volume.fromReference(v));
    }

    getProjectVolumes(projectId) {
        projectId = Number(projectId);

        const dbReferences = this.volumes.filter((v) => v.projectIds.includes(projectId));
        return dbReferences.map((v) => Volume.fromReference(v));
    }

    async create(name, description, userId, projectId) {
        try {
            projectId = Number(projectId);

            let newId = 1;
            if (this.volumes.length > 0) {
                newId = this.volumes.at(-1).id + 1;
            }

            const volume = Volume.createVolume(newId, name, description, userId, projectId, this.config.volumesPath);

            globalEventEmitter.emit('volumeCreated', volume);

            await this.db.update(({volumes}) => volumes.push(volume));
            return volume.id;
        }
        catch (error) {
            throw error;
        }
    }

    async update(volume) {
        const index = this.volumes.findIndex((v) => v.id === volume.id);

        await this.db.update(({volumes}) => volumes[index] = volume);
        return volume;
    }

    async delete(id) {
        id = Number(id);

        const index = this.volumes.findIndex((v) => v.id === id);

        if (index === -1) {
            throw new Error(`Project ${id} does not exist.`);
        }

        const volume = Volume.fromReference(this.volumes[index]);

        globalEventEmitter.emit('volumeDeleted', volume);

        await volume.delete();
        await this.db.update(({ volumes }) => volumes.splice(index, 1));
    }

    async addProject(volumeId, projectId) {
        await super.addProject(Number(volumeId), Number(projectId));
    }

    async removeProject(volumeId, projectId) {
        await super.removeProject(Number(volumeId), Number(projectId));

    }

    getRawVolume(volumeId) {
        return super.getRawVolume(Number(volumeId));
    }

    async addRawVolumeFiles(volumeId, files) {
        return await super.addRawVolumeFiles(Number(volumeId), files);
    }

    async removeRawVolume(volumeId) {
        await super.removeRawVolume(Number(volumeId));
    }

    getSparseLabeledVolume(volumeId) {
        return super.getSparseLabeledVolume(Number(volumeId));
    }

    async addSparseLabeledVolumeFiles(volumeId, files) {
        await super.addSparseLabeledVolumeFiles(Number(volumeId), files);
    }

    async removeSparseLabeledVolume(volumeId, sparseLabeledVolumeId) {
        await super.removeSparseLabeledVolume(Number(volumeId), Number(sparseLabeledVolumeId));
    }

    getPseudoLabeledVolume(volumeId) {
        return super.getPseudoLabeledVolume(Number(volumeId));
    }

    async addPseudoLabeledVolumeFiles(volumeId, files) {
        await super.addPseudoLabeledVolumeFiles(Number(volumeId), files);
    }

    async removePseudoLabeledVolume(volumeId, pseudoLabeledVolumeId) {
        await super.removePseudoLabeledVolume(Number(volumeId), Number(pseudoLabeledVolumeId));
    }
}

const lowdbVolumeControllerInstance = LowdbVolumeController.getInstance();

export default lowdbVolumeControllerInstance;