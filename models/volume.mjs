import fileSystem from "fs";
import {VolumeDataStack} from "./volume-data-stack.mjs";

export class Volume {
    constructor(id, name, description, userId, rawDataId = null, sparseLabeledVolumes = [],
                pseudoLabeledVolumes = [], projectIds = []) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.userId = userId;
        this.rawDataId = rawDataId;
        this.sparseLabeledVolumes = sparseLabeledVolumes;
        this.pseudoLabeledVolumes = pseudoLabeledVolumes;
        this.projectIds = projectIds;
        Object.preventExtensions(this);
    }

    static createVolume(id, name, description, userId, projectId) {
        const volume = new Volume(id, name, description, userId);
        volume.addProject(projectId);
        return volume;
    }

    async delete() {
        if (this.sparseLabeledVolumes) {
            await this.sparseLabeledVolumes.delete();
        }
        if (this.pseudoLabeledVolumes) {
            await this.pseudoLabeledVolumes.delete();
        }
    }

    static fromReference(dbVolume) {
        let sparseLabeledVolumes = null;
        if (dbVolume.sparseLabeledVolumes != null) {
            sparseLabeledVolumes = VolumeDataStack.fromReference(dbVolume.sparseLabeledVolumes);
        }

        let pseudoLabeledVolumes = null;
        if (dbVolume.pseudoLabeledVolumes != null) {
            pseudoLabeledVolumes = VolumeDataStack.fromReference(dbVolume.pseudoLabeledVolumes);
        }

        return new Volume(dbVolume.id, dbVolume.name, dbVolume.description, dbVolume.userId,
            dbVolume.rawDataId, sparseLabeledVolumes, pseudoLabeledVolumes, dbVolume.projectIds);
    }

    addProject(projectId) {
        if (!this.projectIds.includes(projectId)) {
            this.projectIds.push(projectId);
        }
    }

    removeProject(projectId) {
        const index = this.projectIds.indexOf(projectId);
        this.projectIds.splice(index, 1);
    }
}