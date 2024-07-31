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
        return this.getById(volumeId).sparseLabeledVolume;
    }

    async addSparseLabeledVolume(volumeId, file) {
        if (Array.isArray(file)) {
            throw new Error(`Sparse volume has to consist of a single file only.`);
        }

        try {
            const volume = this.getById(volumeId);

            await volume.addSparseLabeledVolume(file);

            await this.update(volume);
            console.log("Raw Data successfully uploaded.");
        }
        catch(error) {
            throw error;
        }
    }

    async removeSparseLabeledVolume(volumeId, sparseLabeledVolumeId) {
        try {
            const volume = this.getById(volumeId);

            await volume.removeSparseLabeledVolume();

            await this.update(volume);
            console.log(`Sparse labeled volume ${sparseLabeledVolumeId} successfully deleted from volume ${volume.name}.`);
        }
        catch (error) {
            throw error;
        }
    }

    getPseudoLabeledVolume(volumeId, pseudoLabeledVolumeId) {
        return this.getById(volumeId).pseudoLabeledVolume;
    }

    async addPseudoLabeledVolume(volumeId, file) {
        if (Array.isArray(file)) {
            throw new Error(`Sparse volume has to consist of a single file only.`);
        }

        try {
            const volume = this.getById(volumeId);

            await volume.addPseudoLabeledVolume(file);

            await this.update(volume);
            console.log("Raw Data successfully uploaded.");
        }
        catch(error) {
            throw error;
        }
    }

    async removePseudoLabeledVolume(volumeId, pseudoLabeledVolumeId) {
        try {
            const volume = this.getById(volumeId);

            await volume.removePseudoLabeledVolume();

            await this.update(volume);
            console.log(`Pseudo labeled volume ${pseudoLabeledVolumeId} successfully deleted from volume ${volume.name}.`);
        }
        catch (error) {
            throw error;
        }
    }
}