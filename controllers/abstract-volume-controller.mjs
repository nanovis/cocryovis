import {AbstractController} from "./abstract-controller.mjs";
import globalEventEmitter from "../tools/global-event-system.mjs";
import lowdbVolumeDataController from "./lowdb/lowdb-volume-data-controller.mjs";
import {VolumeData} from "../models/volume-data.mjs";
import {VolumeDataStack} from "../models/volume-data-stack.mjs";
import path from "path";
import fileSystem from "fs";
import {rm} from "node:fs/promises";
import {rawToTiff} from "../tools/raw-to-tiff.mjs";

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

    getVolumesFromProject(projectId) {
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

    async addRawVolumeFiles(volumeId, userId, files) {
        const volume = this.getById(volumeId);

        if (volume.rawDataId == null) {
            volume.rawDataId = await lowdbVolumeDataController.create(VolumeData.volumeTypes.rawData, volumeId, userId);
        }

        await lowdbVolumeDataController.addFiles(volume.rawDataId, files);

        await this.update(volume);
        console.log("Raw Data successfully uploaded.");
    }

    async addSparseLabeledVolume(volumeId, userId){
        const volume = this.getById(volumeId);

        if (volume.sparseLabeledVolumes == null) {
            volume.sparseLabeledVolumes = new VolumeDataStack(VolumeData.volumeTypes.sparseLabels,
                this.config.maxVolumeChannels);
        }

        if (!volume.sparseLabeledVolumes.canAddMoreVolumes()) {
            throw new Error(
                `Volume ${volume.id} (${volume.name}): Maximum amount of volumes in a sparse volume stack reached (${this.maxSize})`);
        }

        const volumeDataId = await lowdbVolumeDataController.create(VolumeData.volumeTypes.sparseLabels, volumeId, userId);

        volume.sparseLabeledVolumes.addVolumeData(volumeDataId);

        await this.update(volume);
        console.log(`Volume ${volume.id} (${volume.name}): Sparse labeled volume successfully added.`);
    }

    async addPseudoLabeledVolume(volumeId, userId){
        const volume = this.getById(volumeId);

        if (volume.pseudoLabeledVolumes == null) {
            volume.pseudoLabeledVolumes = new VolumeDataStack(VolumeData.volumeTypes.pseudoLabels,
                this.config.maxVolumeChannels);
        }

        if (!volume.pseudoLabeledVolumes.canAddMoreVolumes()) {
            throw new Error(
                `Volume ${volume.id} (${volume.name}): Maximum amount of volumes in a pseudo volume stack reached (${this.maxSize})`);
        }

        const volumeDataId = await lowdbVolumeDataController.create(VolumeData.volumeTypes.pseudoLabels, volumeId, userId);

        volume.pseudoLabeledVolumes.addVolumeData(volumeDataId);

        await this.update(volume);
        console.log(`Volume ${volume.id} (${volume.name}): Pseudo labeled volume successfully added.`);
    }

    async testTiffConversion(volumeId) {
        const volume = this.getById(volumeId);

        const rawData = await lowdbVolumeDataController.getById(volume.rawDataId);
        const sparseLabels = await lowdbVolumeDataController.getSparseLabeledVolumesFromVolume(volumeId);

        const rawTiffFolderPath = path.join("./", "data", "tiff-test", "raw");
        const sparseLabelsTiffFolderPath = path.join("./", "data", "tiff-test", "sparseLabels");

        if (fileSystem.existsSync(rawTiffFolderPath)) {
            await rm(rawTiffFolderPath, { recursive: true, force: true });
        }
        if (fileSystem.existsSync(sparseLabelsTiffFolderPath)) {
            await rm(sparseLabelsTiffFolderPath, { recursive: true, force: true });
        }
        const promises = []
        if (rawData != null) {
            promises.push(rawToTiff(rawData, rawTiffFolderPath));
        }
        if (sparseLabels != null && sparseLabels.length > 0) {
            promises.push(rawToTiff(sparseLabels, sparseLabelsTiffFolderPath));
        }

        await Promise.all(promises);
    }
}