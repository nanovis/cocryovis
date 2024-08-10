import {AbstractController} from "./abstract-controller.mjs";
import {VolumeData} from "../models/volume-data.mjs";

export class AbstractVolumeDataController extends AbstractController {
    constructor() {
        super();
        if(this.constructor === AbstractVolumeDataController) {
            throw new Error("Class is of abstract type and can't be instantiated");
        }
    }

    getById(id) {
        throw new Error('Method not implemented');
    }

    getByIds(ids) {
        throw new Error('Method not implemented');
    }

    getSparseLabeledVolumesFromVolume(volumeId) {
        throw new Error('Method not implemented');
    }

    getPseudoLabeledVolumesFromVolume(volumeId) {
        throw new Error('Method not implemented');
    }

    async create(name, description, userId) {
        throw new Error('Method not implemented');
    }

    async update(project) {
        throw new Error('Method not implemented');
    }

    async delete(id) {
        throw new Error('Method not implemented');
    }

    async addFiles(id, files) {
        const volumeDataObj = this.getById(id);
        await volumeDataObj.uploadFiles(files);
        await this.update(volumeDataObj);
    }

    async removeRawFile(id) {
        console.log(`Volume Data ${id}: Removing raw volume file.`);
        const volumeDataObj = this.getById(id);

        await volumeDataObj.deleteRawFile();

        await this.update(volumeDataObj);
        console.log(`Volume Data ${id}: Raw volume successfully deleted.`);
    }

    async removeSettingsFile(id) {
        console.log(`Volume Data ${id}: Removing settings file.`);
        const volumeDataObj = this.getById(id);

        await volumeDataObj.deleteSettingsFile();

        await this.update(volumeDataObj);
        console.log(`Volume Data ${id}: Settings file successfully deleted.`);
    }
}