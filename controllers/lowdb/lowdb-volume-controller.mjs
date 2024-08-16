import {Volume} from "../../models/volume.mjs";
import LowdbManager from "../../tools/lowdb-manager.mjs";
import {AbstractVolumeController} from "../abstract-volume-controller.mjs";
import globalEventEmitter, {
    volumeCreatedEvent,
    volumeDeletedEvent,
    volumeDataDeletedEvent, projectDeletedEvent
} from "../../tools/global-event-system.mjs";
import {VolumeData} from "../../models/volume-data.mjs";

class LowdbVolumeController extends AbstractVolumeController {
    constructor() {
        super();
        this.db = LowdbManager.db;
        this.volumes = this.db.data.volumes;
        Object.preventExtensions(this);

        globalEventEmitter.on(projectDeletedEvent, async (project) => {
            await this.#onProjectDeleted(project);
        });
        globalEventEmitter.on(volumeDataDeletedEvent, async (volumeData) => {
            await this.#onVolumeDataDeleted(volumeData);
        });
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

    getVolumesFromProject(projectId) {
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

            const volume = Volume.createVolume(newId, name, description, userId, projectId);

            globalEventEmitter.emit(volumeCreatedEvent, volume);

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

        globalEventEmitter.emit(volumeDeletedEvent, volume);

        await volume.delete();
        await this.db.update(({ volumes }) => volumes.splice(index, 1));
    }

    async addProject(volumeId, projectId) {
        await super.addProject(Number(volumeId), Number(projectId));
    }

    async removeProject(volumeId, projectId) {
        await super.removeProject(Number(volumeId), Number(projectId));
    }

    async #onProjectDeleted(project) {
        const volumes = this.getByIds(project.volumeIds);
        for (const volume of volumes) {
            if (volume.projectIds.includes(project.id)) {
                await this.removeProject(volume.id, project.id);
            }
        }
    }

    async #onVolumeDataDeleted(volumeData) {
        const volumes = this.getByIds(volumeData.volumeIds);
        if (volumeData.type === VolumeData.volumeTypes.rawData) {
            for (const volume of volumes) {
                if (volume.rawDataId === volumeData.id) {
                    volume.rawDataId = null;
                    await this.update(volume);
                }
            }
        }
        else if (volumeData.type === VolumeData.volumeTypes.sparseLabels) {
            for (const volume of volumes) {
                try {
                    volume.sparseLabeledVolumes.removeVolumeData(volumeData.id);
                }
                catch (e) {
                    console.error(e);
                }
            }
        }
        else if (volumeData.type === VolumeData.volumeTypes.pseudoLabels) {
            for (const volume of volumes) {
                try {
                    volume.pseudoLabeledVolumes.removeVolumeData(volumeData.id);
                }
                catch (e) {
                    console.error(e);
                }
            }
        }
    }

    async addRawVolumeFiles(volumeId, userId, files) {
        await super.addRawVolumeFiles(Number(volumeId), userId, files);
    }

    async addRawVolumeMrcFile(volumeId, userId, file) {
        await super.addRawVolumeMrcFile(Number(volumeId), userId, file);
    }
}

const lowdbVolumeControllerInstance = LowdbVolumeController.getInstance();

export default lowdbVolumeControllerInstance;