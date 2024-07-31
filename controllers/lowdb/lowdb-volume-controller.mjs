import {Volume} from "../../models/volume.mjs";
import LowdbManager from "../../tools/lowdb-manager.mjs";
import path from "path";
import {SparseLabeledVolume} from "../../models/sparse-labeled-volume.mjs";
import {PseudoLabeledVolume} from "../../models/pseudo-labeled-volume.mjs";
import {saveData} from "../../tools/utils.mjs";
import {AbstractVolumeController} from "../abstract-volume-controller.mjs";
import globalEventEmitter from "../../tools/global-event-system.mjs";

class LowdbVolumeController extends AbstractVolumeController {
    constructor() {
        super();
        this.db = LowdbManager.db;
        this.volumes = this.db.data.volumes;
        globalEventEmitter.on('projectDeleted', async (project) => {
            await this.onProjectDeleted(project);
        });
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

    async onProjectDeleted(project) {
        const volumes = this.getByIds(project.volumeIds);
        for (const volume in volumes) {
            if (project.id in volume.projectIds) {
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
        return super.getRawVolume(Number(volumeId));
    }

    async addRawVolume(volumeId, file) {
        return await super.addRawVolume(Number(volumeId), file);
    }

    async removeRawVolume(volumeId) {
        await super.removeRawVolume(Number(volumeId));
    }

    getSparseLabeledVolume(volumeId, sparseLabeledVolumeId) {
        return super.getSparseLabeledVolume(Number(volumeId), Number(sparseLabeledVolumeId));
    }

    async addSparseLabeledVolumes(volumeId, files) {
        volumeId = Number(volumeId);
        const volume = this.getById(volumeId);

        let nextId = 1;
        if (volume.sparseLabels.length > 0) {
            nextId = volume.sparseLabels.at(-1).id + 1;
        }

        let volumeAdded = false;

        try {
            const {fileNames, filePaths} = await saveData(files,
                path.join(volume.path, Volume.subfolders.sparseLabels), [".raw"], false);
            for (let i = 0; i < fileNames.length; i++) {
                const newSparseLabeledVolume = SparseLabeledVolume
                    .createSparseLabeledVolume(nextId, fileNames[i], filePaths[i]);
                nextId++;
                volume.addSparseLabel(newSparseLabeledVolume);
                volumeAdded = true;
            }
        }
        catch (error) {
            throw error;
        }

        if (!volumeAdded) {
            throw new Error(`No valid files found.`);
        }
        await this.update(volume);
        console.log("Sparse Labeled Volumes successfully uploaded.");
    }

    async removeSparseLabeledVolume(volumeId, sparseLabeledVolumeId) {
        await super.removeSparseLabeledVolume(Number(volumeId), Number(sparseLabeledVolumeId));
    }

    getPseudoLabeledVolume(volumeId, pseudoLabeledVolumeId) {
        return super.getPseudoLabeledVolume(Number(volumeId), Number(pseudoLabeledVolumeId));
    }

    async addPseudoLabeledVolumes(volumeId, files) {
        volumeId = Number(volumeId);
        const volume = this.getById(volumeId);

        let nextId = 1;
        if (volume.pseudoLabels.length > 0) {
            nextId = volume.pseudoLabels.at(-1).id + 1;
        }

        let volumeAdded = false;

        try {
            const {fileNames, filePaths} = await saveData(files,
                path.join(volume.path, Volume.subfolders.pseudoLabels), [".raw"], false);
            for (let i = 0; i < fileNames.length; i++) {
                const newPseudoLabeledVolume = PseudoLabeledVolume
                    .createPseudoLabeledVolume(nextId, fileNames[i], filePaths[i]);
                volume.addPseudoLabel(newPseudoLabeledVolume);
                nextId++;
                volumeAdded = true;
            }
        }
        catch (error) {
            throw error;
        }

        if (!volumeAdded) {
            throw new Error(`No valid files found.`);
        }
        await this.update(volume);
        console.log("Pseudo Labeled Volumes successfully uploaded.");
    }

    async removePseudoLabeledVolume(volumeId, pseudoLabeledVolumeId) {
        await super.removePseudoLabeledVolume(Number(volumeId), Number(pseudoLabeledVolumeId));
    }
}

const lowdbVolumeControllerInstance = LowdbVolumeController.getInstance();

export default lowdbVolumeControllerInstance;