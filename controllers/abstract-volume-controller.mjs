import {AbstractController} from "./abstract-controller.mjs";
import globalEventEmitter from "../tools/global-event-system.mjs";

export class AbstractVolumeController extends AbstractController {
    constructor() {
        super();
        if(this.constructor === AbstractVolumeController) {
            throw new Error("Class is of abstract type and can't be instantiated");
        }
        globalEventEmitter.on('projectDeleted', async (project) => {
            await this.onProjectDeleted(project);
        });
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

    async onProjectDeleted(project) {
        const volumes = this.getByIds(project.volumeIds);
        for (const volume of volumes) {
            if (volume.projectIds.includes(project.id)) {
                await this.removeProject(volume.id, project.id);
            }
        }
    }

    async addProject(volumeId, projectId) {
        const volume = this.getById(volumeId);
        volume.addProject(projectId);
        await this.update(volume);
    }

    async removeProject(volumeId, projectId) {
        const volume = this.getById(volumeId);
        volume.removeProject(projectId);
        if (volume.projectIds.length === 0) {
            await this.delete(volume.id);
        }
        else {
            await this.update(volume);
        }
    }

    getRawVolume(volumeId) {
        return this.getById(volumeId).rawData;
    }

    async addRawVolumeFiles(volumeId, files) {
        try {
            const volume = this.getById(volumeId);

            await volume.addRawDataFiles(files);

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

    async removeRawFileFromRawVolume(volumeId) {
        try {
            const volume = this.getById(volumeId);

            if (volume.rawData == null) {
                throw new Error(`Volume ${volume.id} (${volume.name}): Volume does not have a raw volume.`);
            }

            await volume.rawData.deleteRawFile();

            await this.update(volume);
            console.log(`Volume ${volume.id} (${volume.name}): Raw file successfully removed from raw volume.`);
        }
        catch (error) {
            throw error;
        }
    }

    async removeSettingsFileFromRawVolume(volumeId) {
        try {
            const volume = this.getById(volumeId);

            if (volume.rawData == null) {
                throw new Error(`Volume ${volume.id} (${volume.name}): Volume does not have a raw volume.`);
            }

            await volume.rawData.deleteSettingsFile();

            await this.update(volume);
            console.log(`Volume ${volume.id} (${volume.name}): Settings file successfully removed from raw volume.`);
        }
        catch (error) {
            throw error;
        }
    }

    async removeTiffFilesFromRawVolume(volumeId) {
        try {
            const volume = this.getById(volumeId);

            if (volume.rawData == null) {
                throw new Error(`Volume ${volume.id} (${volume.name}): Volume does not have a raw volume.`);
            }

            await volume.rawData.deleteTiffFolder();

            await this.update(volume);
            console.log(`Volume ${volume.id} (${volume.name}): Tiff files successfully removed from raw volume.`);
        }
        catch (error) {
            throw error;
        }
    }

    getSparseLabeledVolume(volumeId) {
        return this.getById(volumeId).sparseLabeledVolume;
    }

    async addSparseLabeledVolumeFiles(volumeId, files) {
        try {
            const volume = this.getById(volumeId);

            await volume.addSparseLabeledVolumeFiles(files);

            await this.update(volume);
            console.log("Raw Data successfully uploaded.");
        }
        catch(error) {
            throw error;
        }
    }

    async removeSparseLabeledVolume(volumeId) {
        try {
            const volume = this.getById(volumeId);

            await volume.removeSparseLabeledVolume();

            await this.update(volume);
            console.log(`Sparse labeled volume successfully deleted from volume ${volume.name}.`);
        }
        catch (error) {
            throw error;
        }
    }

    getPseudoLabeledVolume(volumeId) {
        return this.getById(volumeId).pseudoLabeledVolume;
    }

    async addPseudoLabeledVolumeFiles(volumeId, files) {
        try {
            const volume = this.getById(volumeId);

            await volume.addPseudoLabeledVolumeFiles(files);

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