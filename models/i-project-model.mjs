export class IProjectModel {
    constructor(config) {
        if(this.constructor === IProjectModel) {
            throw new Error("Class is of abstract type and can't be instantiated");
        }
        this.config = config;
        if (this.config === undefined) {
            throw new Error("Missing projects config");
        }
    }

    getUserProjects(userId) {
        throw new Error('Method not implemented');
    }

    getById(id) {
        throw new Error('Method not implemented');
    }

    async create(project) {
        throw new Error('Method not implemented');
    }

    async update(id, project) {
        throw new Error('Method not implemented');
    }

    async delete(id) {
        throw new Error('Method not implemented');
    }

    getVolume(projectId, volumeId) {
        return this.getById(projectId).findVolume(volumeId);
    }

    async addVolume(projectId, name, description){
        throw new Error('Method not implemented');
    }

    async removeVolume(projectId, volumeId){
        try {
            const project = this.getById(projectId);

            await project.removeVolume(volumeId);

            await this.update(projectId, project);
            console.log(`Volume ${volumeId} successfully deleted.`);
        }
        catch (error) {
            throw error;
        }
    }

    getRawVolume(projectId, volumeId) {
        return this.getById(projectId).findVolume(volumeId).rawData;
    }

    async addRawVolume(projectId, volumeId, file) {
        if (Array.isArray(file)) {
            throw new Error(`Raw data has to consist of a single file only.`);
        }

        try {
            const project = this.getById(projectId);
            const volume = project.findVolume(volumeId);

            await volume.addRawData(file);

            await this.update(projectId, project);
            console.log("Raw Data successfully uploaded.");
        }
        catch(error) {
            throw error;
        }
    }

    async removeRawVolume(projectId, volumeId) {
        try {
            const project = this.getById(projectId);
            const volume = project.findVolume(volumeId);

            await volume.removeRawData();

            await this.update(projectId, project);
            console.log("Raw Data successfully deleted.");
        }
        catch (error) {
            throw error;
        }
    }

    getSparseLabeledVolume(projectId, volumeId, sparseLabeledVolumeId) {
        return this.getById(projectId).findVolume(volumeId).findSparseLabel(sparseLabeledVolumeId);
    }

    async addSparseLabeledVolumes(projectId, volumeId, files) {
        throw new Error('Method not implemented');
    }

    async removeSparseLabeledVolume(projectId, volumeId, sparseLabeledVolumeId) {
        const project = this.getById(projectId);
        const volume = project.findVolume(volumeId);

        await volume.removeSparseLabel(sparseLabeledVolumeId);

        await this.update(projectId, project);
        console.log(`Sparse labeled volume ${sparseLabeledVolumeId} successfully deleted from volume ${volume.name}.`);
    }

    getPseudoLabeledVolume(projectId, volumeId, pseudoLabeledVolumeId) {
        return this.getById(projectId).findVolume(volumeId).findPseudoLabel(pseudoLabeledVolumeId);
    }

    async addPseudoLabeledVolumes(projectId, volumeId, files) {
        throw new Error('Method not implemented');
    }

    async removePseudoLabeledVolume(projectId, volumeId, pseudoLabeledVolumeId) {
        const project = this.getById(projectId);
        const volume = project.findVolume(volumeId);

        await volume.removePseudoLabel(pseudoLabeledVolumeId);

        await this.update(projectId, project);
        console.log(`Pseudo labeled volume ${pseudoLabeledVolumeId} successfully deleted from volume ${volume.name}.`);
    }

    getModel(projectId, modelId) {
        return this.getById(projectId).findModel(modelId);
    }

    async addModel(projectId, name, description) {
        throw new Error('Method not implemented');
    }

    async removeModel(projectId, modelId) {
        try {
            const project = this.getById(projectId);

            await project.removeModel(modelId);
            await this.update(projectId, project);
            console.log(`Model ${modelId} successfully deleted.`);
        }
        catch (error) {
            throw error;
        }
    }
}