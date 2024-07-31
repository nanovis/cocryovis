import {AbstractController} from "./abstract-controller.mjs";

export class AbstractVolumeController extends AbstractController {
    constructor() {
        super();
        if(this.constructor === AbstractVolumeController) {
            throw new Error("Class is of abstract type and can't be instantiated");
        }
    }

    getAllVolumes() {
        throw new Error('Method not implemented');
    }

    getById(id) {
        throw new Error('Method not implemented');
    }

    getByIds(ids) {
        throw new Error('Method not implemented');
    }

    getProjectVolumes(projectId) {
        throw new Error('Method not implemented');
    }

    async create(name, description, projectId) {
        throw new Error('Method not implemented');
    }

    async update(volume) {
        throw new Error('Method not implemented');
    }

    async delete(id) {
        throw new Error('Method not implemented');
    }

    getRawVolume(volumeId) {
        return this.getById(volumeId).rawData;
    }

    async addRawVolume(volumeId, file) {
        if (Array.isArray(file)) {
            throw new Error(`Raw data has to consist of a single file only.`);
        }

        try {
            const volume = this.getById(volumeId);

            await volume.addRawData(file);

            await this.update(volume);
            console.log("Raw Data successfully uploaded.");
        }
        catch(error) {
            throw error;
        }
    }

    async removeRawVolume(volumeId) {
        try {
            const volume = this.getById(volumeId);

            await volume.removeRawData();

            await this.update(volume);
            console.log("Raw Data successfully deleted.");
        }
        catch (error) {
            throw error;
        }
    }

    getSparseLabeledVolume(volumeId, sparseLabeledVolumeId) {
        return this.getById(volumeId).findSparseLabel(sparseLabeledVolumeId);
    }

    async addSparseLabeledVolumes(volumeId, files) {
        throw new Error('Method not implemented');
    }

    async removeSparseLabeledVolume(volumeId, sparseLabeledVolumeId) {
        const volume = this.getById(volumeId);

        await volume.removeSparseLabel(sparseLabeledVolumeId);

        await this.update(volume);
        console.log(`Sparse labeled volume ${sparseLabeledVolumeId} successfully deleted from volume ${volume.name}.`);
    }

    getPseudoLabeledVolume(volumeId, pseudoLabeledVolumeId) {
        return this.getById(volumeId).findPseudoLabel(pseudoLabeledVolumeId);
    }

    async addPseudoLabeledVolumes(volumeId, files) {
        throw new Error('Method not implemented');
    }

    async removePseudoLabeledVolume(volumeId, pseudoLabeledVolumeId) {
        const volume = this.getById(volumeId);

        await volume.removePseudoLabel(pseudoLabeledVolumeId);

        await this.update(volume);
        console.log(`Pseudo labeled volume ${pseudoLabeledVolumeId} successfully deleted from volume ${volume.name}.`);
    }
}