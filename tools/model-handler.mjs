import  * as fileSystem from 'fs';
import AdmZip from 'adm-zip';

class ModelHandler {
    constructor(config, models) {
        this.config = config;
        this.models = models;
    }
    
    types = {
        rawData: 'raw-data',
        sparseLabels: 'sparse-labels',
        ilastikLabels: 'ilastik-labels',
        checkpoints: 'checkpoints',
        inferenceData: 'inference-data',
        predictions: 'predictions'
    };
    
    dependentIdTypes = {
        sparseLabels: 'idRawData',
        ilastikLabels: 'idSparseLabels'
    };

    createNewModel(name, description, userId) {
        const model = {};
        try {
            if (this.models.length == 0) {
                model.id = 1;
            } else {
                model.id = this.models.at(-1).id + 1;
            }
            model.name = name;
            model.path = this.config.path + model.id + '-' + model.name.replace(/\s+/g, '_');
            fileSystem.mkdirSync(model.path);
        
            model.description = description;
            model.userId = userId;
            
            model.rawData = [];
            fileSystem.mkdirSync(model.path + '/' + this.types.rawData);
            
            model.sparseLabels = [];
            fileSystem.mkdirSync(model.path + '/' + this.types.sparseLabels);
            
            model.ilastikLabels = [];
            fileSystem.mkdirSync(model.path + '/' + this.types.ilastikLabels);
            
            model.checkpoints = [];
            fileSystem.mkdirSync(model.path + '/' + this.types.checkpoints);

            model.inferenceData = [];
            fileSystem.mkdirSync(model.path + '/' + this.types.inferenceData);

            model.predictions = [];
            fileSystem.mkdirSync(model.path + '/' + this.types.predictions);
            
            this.models.push(model);
        } catch (err) {
            console.log("Error creating new model.");
        }
        return model.id;
    }

    deleteModel(modelId) {
        try {
            const modelIndex = this.models.findIndex((m) => m.id == modelId);
            const modelPath = this.models[modelIndex].path;
            fileSystem.rm(modelPath, { recursive: true, force: true }, (err) => {
                if (err) {
                    console.log("Error deleting model folders.");
                    console.log(err);
                }
            });
            this.models.splice(modelIndex, 1);
            console.log("Model successfully deleted.");
        } catch (err) {
            console.log("Error deleting model.");
        }
    }

    uploadData(modelId, type, files, dataId) {
        const model = this.models.find((m) => m.id == modelId);
        try {
            const uploadPath = model.path + '/' + this.types[type];
            let promises = [];
            const data = {};
            if (model[type].length == 0) {
                data.id = 1;
            } else {
                data.id = model[type].at(-1).id + 1;
            }
            if (dataId) {
                data[this.dependentIdTypes[type]] = dataId;
            }
            if (type == this.types.checkpoints) {
                data.filename = files.name;
            }
            if (type == "inferenceData") {
                let filename = "";
                if (Array.isArray(files)) {
                    filename = files[0].name;
                    files.forEach((file) => {
                        if (file.name.endsWith('json'))
                            filename = file.name;
                    });
                } else {
                    filename = files.name;
                }
                data.filename = filename;
            }

            if (Array.isArray(files)) {
                files.forEach((file) => {
                    promises.push(file.mv(uploadPath + '/' + data.id + '/' + file.name));
                });
                model[type].push(data);
            } else {
                model[type].push(data);
                if (files.name.endsWith('.zip')) {
                    let zip = new AdmZip(files.data);
                    zip.extractAllTo(uploadPath + '/' + data.id + '/', true);
                } else {
                    promises.push(files.mv(uploadPath + '/' + data.id + '/' + files.name));
                }
            }
            console.log("Data successfully uploaded.");
            return promises;
        } catch (err) {
            console.log("Error uploading data.");
        }
    }

    downloadData(modelId, type, dataId) {
        const model = this.models.find((m) => m.id == modelId);
        const data = model[type].find((r) => r.id == dataId);
        const filePath = model.path + '/' + this.types[type] + '/' + data.id;
        const zip = new AdmZip();
        if (type === 'predictions') {
            Object.entries(data.files).forEach(([key, file]) => {
                zip.addLocalFile(filePath + '/' + file);
            });
            Object.entries(data.visualizationFiles).forEach(([key, file]) => {
                if (file.url === '/data/') {
                    zip.addLocalFile('./web/' + file.url + file.filename);
                } else {
                    zip.addLocalFile(filePath + '/' + file.filename);
                }
            });
        } else {
            zip.addLocalFolder(filePath);
        }
        return {
            name: model.name + '_' + this.types[type] + '_' + data.id + '.zip',
            zipBuffer: zip.toBuffer()
        };
    }

    deleteData(modelId, type, dataId) {
        try {
            const model = this.models.find((m) => m.id == modelId);

            if (type == 'rawData') { // delete related sparse labels and ilastik labels
                let sparseLabelsIndex = -1;
                while ((sparseLabelsIndex = model.sparseLabels.findIndex((sl) => sl.idRawData == dataId)) != -1) {
                    this.deleteData(modelId, 'sparseLabels', model[type][sparseLabelsIndex].id);
                }
            } else if (type == 'sparseLabels') { // delete related ilastik labels
                let ilastikLabelsIndex = -1;
                while ((ilastikLabelsIndex = model.ilastikLabels.findIndex((il) => il.idSparseLabel == dataId)) != -1) {
                    this.deleteData(modelId, 'ilastikLabels', model[type][ilastikLabelsIndex].id);
                }
            }

            const datIndex = model[type].findIndex((il) => il.id == dataId);
            const dataPath = model.path + '/' + this.types[type] + '/' + dataId;
            fileSystem.rm(dataPath, { recursive: true, force: true }, (err) => {
                if (err) {
                    console.log("Error deleting " + this.types[type] + " files.");
                }
            });
            model[type].splice(datIndex, 1);
        } catch (err) {
            console.log("Error deleting " + this.types[type] + " files.");
        }
    }
}

export {ModelHandler};