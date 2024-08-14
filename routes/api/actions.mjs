import express from 'express';
import DatabaseManager from "../../tools/lowdb-manager.mjs";
import { spawn } from 'child_process';
import path from 'path';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import { DateHandler } from '../../tools/date-handler.mjs';
import  * as fileSystem from 'fs';
import { IlastikHandler as ModelBasedIlastikHandler } from '../../tools/ilastik-handler-model-based.mjs';
import { IlastikHandler } from '../../tools/ilastik-handler.mjs';
import { NanoOetziHandler } from '../../tools/nano-oetzi-handler.mjs';
import { restrict } from '../../middleware/restrict.mjs';
import { ModelHandler } from '../../tools/model-handler.mjs';
import * as fs from 'fs';
import { ControllerFactory } from "../../controllers/controller-factory.mjs";
import {publicDataPath, publicPath} from "../../tools/utils.mjs";
import appConfig from "../../tools/config.mjs";

// Config
const config = appConfig;
const ilastik = new ModelBasedIlastikHandler(config.ilastik);
const ilastikHandler = new IlastikHandler(config.ilastik);
const nanoOetzi = new NanoOetziHandler(config.nanoOetzi);

// DB connection
const db = DatabaseManager.db;
const models = db.data.models;
const modelHandler = new ModelHandler(config.models, models);

const projectController = ControllerFactory.getProjectController(config.db.type);
const volumeController = ControllerFactory.getVolumeController(config.db.type);
const volumeDataController = ControllerFactory.getVolumeDataController(config.db.type);
const modelController = ControllerFactory.getModelController(config.db.type);
const checkpointController = ControllerFactory.getCheckpointController(config.db.type);

export const actions = express.Router();

actions.use(cors());
actions.use(fileUpload({ createParentPath: true }));

actions.get('/', restrict, (req, res) => {
    res.send("List of possible actions");
});


//// ***** TEST actions ***** ////
actions.get('/who-am-i', restrict, (req, res) => {
    res.send("I am a user: " + req.session.user.name);
});

actions.get('/python-version', restrict, (req, res) => {
    const python = spawn('python', ['-V']);
    python.stdout.on('data', (data) => {
        res.send(data.toString());
    });
});

actions.get('/list-uploaded-files', restrict, (req, res) => {
    const ls = spawn('ls', ['-1', './uploads']);
    ls.stdout.on('data', (data) => {
        let response = data.toString().split('\n').map((l) => {
            return '<a href="/api/actions/files/' + l + '">' + l + '</a>'
        }).join('<br />');
        res.send(response);
    });
});

// File download site
actions.get('/files/:file(*)', restrict, function (req, res, next) {
    var filePath = path.join('./uploads/', req.params.file);
    res.download(filePath, function (err) {
        if (!err) return; // file sent
        if (err.status !== 404) return next(err); // non-404 error
        // file for download not found
        res.statusCode = 404;
        res.send('Cant find that file, sorry!');
    });
});

// File upload site
actions.get('/file-upload', restrict, function (req, res) {
    res.render('file-upload');
});

// Upload file
actions.post('/file-upload', async (req, res) => {
    try {
        if (!req.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {
            const files = req.files.files;
            let promises = [];
            if (Array.isArray(files)) {
                files.forEach((file) => {
                    var dateString = DateHandler.getInverseDateString();
                    promises.push(file.mv('./uploads/' + file.name.split(/\.(?=[^\.]+$)/)[0] + '_' + dateString + '.' + file.name.split(/\.(?=[^\.]+$)/)[1]));
                });
            } else {
                var dateString = DateHandler.getInverseDateString();
                promises.push(files.mv('./uploads/' + files.name.split(/\.(?=[^\.]+$)/)[0] + '_' + dateString + '.' + files.name.split(/\.(?=[^\.]+$)/)[1]));
            }
            await Promise.all(promises);
            console.log(req.files.files.length);
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

//// ***** END of TEST actions ***** ////



// Model actions

// Model details

actions.get('/model-details/:id', restrict, async (req, res) => {
    console.log*('Model details');
    const model = models.find((m) => m.id == req.params.id);
    res.render('model-details', { model: model });
});

// List models
actions.get('/list-models', restrict, (req, res) => {
    res.render('list-models', { models: models });
});

// Create new model
actions.get('/create-model', restrict, (req, res) => {
    res.render('create-model');
});
actions.post('/create-model', restrict, async (req, res) => {
    console.log('Creating new model');
    try {
        if (!fileSystem.existsSync(config.models.path)) {
            fileSystem.mkdirSync(config.models.path);
            console.log('Created models directory');
        }
        
        const modelId = modelHandler.createNewModel(req.body.name, req.body.description, req.session.user.id);

        await db.write();
        console.log("Model successfully created.");
        res.redirect('/api/actions/model-details/' + modelId);
    } catch (err) {
        res.status(500).send(err);
    }
});

// Delete model
actions.get('/delete-model/:id', restrict, async (req, res) => {
    console.log('Deleting model');
    try {
        modelHandler.deleteModel(req.params.id);
        await db.write();
    } catch (err) {
        res.status(500).send(err);
    }
    res.redirect('/api/actions/list-models');
});

// Upload Raw Data
actions.post('/upload-raw-data/:id', restrict, async (req, res) => {
    console.log('Uploading raw data for model id: ' + req.params.id);
    try {
        if (!req.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {
            let promises = modelHandler.uploadData(req.params.id, 'rawData', req.files.files);
            await Promise.all(promises);
            await db.write();
            // res.redirect('/api/actions/model-details/' + model.id);
            res.send("success!");
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

// Download Raw Data
actions.get('/download-raw-data/:id/:rawDataId', restrict, async (req, res) => {
    console.log('Downloading raw data for model id: ' + req.params.id);
    let data = modelHandler.downloadData(req.params.id, 'rawData', req.params.rawDataId);
    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', 'attachment; filename=' + data.name);
    res.send(data.zipBuffer);
});

// Delete Raw Data
actions.get('/delete-raw-data/:id/:rawDataId', restrict, async (req, res) => {
    console.log('Deleting raw data for model id: ' + req.params.id);
    const model = models.find((m) => m.id == req.params.id);
    try {
        modelHandler.deleteData(req.params.id, 'rawData', req.params.rawDataId);
        await db.write();
    } catch (err) {
        res.status(500).send(err);
    }
    console.log("Raw data successfully deleted.");
    res.redirect('/api/actions/model-details/' + model.id);
});


// Upload Sparse Labels
actions.post('/upload-sparse-labels/:id/:idRawData', restrict, async (req, res) => {
    console.log('Uploading sparse labels for model id: ' + req.params.id);
    try {
        if (!req.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {
            let promises = modelHandler.uploadData(req.params.id, 'sparseLabels', req.files.files, req.params.idRawData);
            await Promise.all(promises);
            await db.write();
            console.log("Sparse labels successfully uploaded.");
            // res.redirect('/api/actions/model-details/' + model.id);
            res.send("success!");
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

// Download Sparse Label
actions.get('/download-sparse-label/:id/:sparseLabelsId', restrict, async (req, res) => {
    console.log('Downloading sparse labels for model id: ' + req.params.id);
    let data = modelHandler.downloadData(req.params.id, 'sparseLabels', req.params.sparseLabelsId);
    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', 'attachment; filename=' + data.name);
    res.send(data.zipBuffer);
});

// Delete Sparse Labels
actions.get('/delete-sparse-label/:id/:sparseLabelsId', restrict, async (req, res) => {
    console.log('Deleting sparse labels for model id: ' + req.params.id);
    const model = models.find((m) => m.id == req.params.id);
    try {
        modelHandler.deleteData(req.params.id, 'sparseLabels', req.params.sparseLabelsId);
        await db.write();
    } catch (err) {
        res.status(500).send(err);
    }
    console.log("Sparse labels successfully deleted.");
    res.redirect('/api/actions/model-details/' + model.id);
});


// Generate Ilastik Labels
actions.get('/generate-ilastik-labels/:id/:idRawData/:idSparseLabels', restrict, async (req, res) => {
    console.log('Generating ilastik labels for model id: ' + req.params.id);
    const model = models.find((m) => m.id == req.params.id);
    const rawDataId = req.params.idRawData;
    const sparseLabelsId = req.params.idSparseLabels;
    ilastik.generateLabels(model.path, rawDataId, sparseLabelsId, model, db);
    res.redirect('/api/actions/model-details/' + model.id);
    // res.send("success!");
});

// Get Ilastik status
actions.get('/get-ilastik-status/', restrict, async (req, res) => {
    console.log(ilastik.getOutput());
    res.send(ilastik.getOutput());
});
    

// Upload Ilastik Labels
actions.post('/upload-ilastik-labels/:id/:idSparseLabel', restrict, async (req, res) => {
    console.log('Uploading ilastik labels for model id: ' + req.params.id);
    try {
        if (!req.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {
            let promises = modelHandler.uploadData(req.params.id, 'ilastikLabels', req.files.files, req.params.idSparseLabel);
            await Promise.all(promises);
            await db.write();
            console.log("Ilastik labels successfully uploaded.");
            // res.redirect('/api/actions/model-details/' + model.id);
            res.send("success!");
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

// Download Ilastik Label
actions.get('/download-ilastik-label/:id/:ilastikLabelsId', restrict, async (req, res) => {
    console.log('Downloading ilastik labels for model id: ' + req.params.id);
    let data = modelHandler.downloadData(req.params.id, 'rawData', req.params.ilastikLabelsId);
    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', 'attachment; filename=' + data.name);
    res.send(data.zipBuffer);
});

// Delete Ilastik Labels
actions.get('/delete-ilastik-label/:id/:idIlastikLabel', restrict, async (req, res) => {
    console.log('Deleting ilastik labels for model id: ' + req.params.id);
    try {
        modelHandler.deleteData(req.params.id, 'ilastikLabels', req.params.idIlastikLabel);
        await db.write();
    } catch (err) {
        res.status(500).send(err);
    }
    console.log("Ilastik labels successfully deleted.");
    res.redirect('/api/actions/model-details/' + req.params.id);
});         


// Ilastik actions
actions.get('/ilastik-version', restrict, (req, res) => {
    try {
        res.send("Ilastik version: " + ilastikHandler.getVersion());
    }
    catch (e) {
        res.send(e);
    }
});

// Nano-Oetzi actions

// Upload checkpoint
actions.post('/upload-checkpoint/:id', restrict, async (req, res) => {
    console.log('Uploading checkpoint for model id: ' + req.params.id);
    try {
        if (!req.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {
            let promises = modelHandler.uploadData(req.params.id, 'checkpoints', req.files.files);
            await Promise.all(promises);
            await db.write();
            console.log("Checkpoint successfully uploaded.");
            res.send("success!");
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

// Delete checkpoint
actions.get('/delete-checkpoint/:id/:checkpointId', restrict, async (req, res) => {
    console.log('Deleting checkpoint for model id: ' + req.params.id);
    try {
        modelHandler.deleteData(req.params.id, 'checkpoints', req.params.checkpointId);
        await db.write();
    } catch (err) {
        res.status(500).send(err);
    }
    console.log("Checkpoint successfully deleted.");
    res.redirect('/api/actions/model-details/' + req.params.id);
});

// Download checkpoint
actions.get('/download-checkpoint/:id/:checkpointId', restrict, async (req, res) => {
    console.log('Downloading checkpoint for model id: ' + req.params.id);
    let data = modelHandler.downloadData(req.params.id, 'checkpoints', req.params.checkpointId);
    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', 'attachment; filename=' + data.name);
    res.send(data.zipBuffer);
});

// Upload inference data
actions.post('/upload-inference-data/:id', restrict, async (req, res) => {
    console.log('Uploading inference data for model id: ' + req.params.id);
    try {
        if (!req.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {
            let promises = modelHandler.uploadData(req.params.id, 'inferenceData', req.files.files);
            await Promise.all(promises);
            await db.write();
            console.log("inference data successfully uploaded.");
            res.send("success!");
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

// Download inference data
actions.get('/download-inference-data/:id/:inferenceDataId', restrict, async (req, res) => {
    console.log('Downloading inference data for model id: ' + req.params.id);
    let data = modelHandler.downloadData(req.params.id, 'inferenceData', req.params.inferenceDataId);
    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', 'attachment; filename=' + data.name);
    res.send(data.zipBuffer);
});

// Delete inference data
actions.get('/delete-inference-data/:id/:inferenceDataId', restrict, async (req, res) => {
    console.log('Deleting inference data for model id: ' + req.params.id);
    try {
        modelHandler.deleteData(req.params.id, 'inferenceData', req.params.inferenceDataId);
        await db.write();
    } catch (err) {
        res.status(500).send(err);
    }
    console.log("Inference data successfully deleted.");
    res.redirect('/api/actions/model-details/' + req.params.id);
});

// Run inference
actions.get('/run-inference/:id/:inferenceDataId/:checkpointId', restrict, async (req, res) => {
    console.log('Running inference for model id: ' + req.params.id);
    try {
        const data = {};
        const model = models.find((m) => m.id == req.params.id);
        const inferenceData = model.inferenceData.find((d) => d.id == req.params.inferenceDataId);
        if (model.predictions.length == 0) {
            data.id = 1;
        } else {
            data.id = model.predictions.at(-1).id + 1;
        }
        const checkpoint = model.checkpoints.find((c) => c.id == req.params.checkpointId);
        nanoOetzi.runInference(model.path + '/' + modelHandler.types.inferenceData + '/' + inferenceData.id + '/' + inferenceData.filename, 
                               model.path + '/' + modelHandler.types.predictions + '/' + data.id + '/',
                               model.path + '/' + modelHandler.types.checkpoints + '/' + checkpoint.id + '/' + checkpoint.filename);
        
        let predictionFilePrefix = inferenceData.filename.slice(0, -5);
        data.checkpointId = checkpoint.id;
        data.inferenceDataId = inferenceData.id;
        data.files = {
            background: predictionFilePrefix + "_predictions-Background.json",
            inner: predictionFilePrefix + "_predictions-Inner.json",
            membrane: predictionFilePrefix + "_predictions-Membrane.json",
            spikes: predictionFilePrefix + "_predictions-Spikes.json",
            meanInvBack: predictionFilePrefix + "_mean3_inverted.json",
        };
        let configJSON = {
            files: [
                "ts_16_bin4-256x256_predictions-Spikes.json",
                "ts_16_bin4-256x256_predictions-Membrane.json",
                "ts_16_bin4-256x256_predictions-Inner.json", 
                "ts_16_bin4-256x256_mean3_inverted.json",
                "ts_16_bin4-256x256_predictions-Background.json"
            ]
        };
        let configJSONstring = JSON.stringify(configJSON, null, 2);
        let configJSONpath = model.path + '/' + modelHandler.types.predictions + '/' + data.id + '/' + 'config.json';
        fs.writeFileSync(configJSONpath, configJSONstring);

        data.visualizationFiles =  [
            { url: '/data/', filename: 'session.json'},
            { url: '/data/', filename: 'tf-Background.json'},
            { url: '/data/', filename: 'tf-Inner.json'},
            { url: '/data/', filename: 'tf-Membrane.json'},
            { url: '/data/', filename: 'tf-raw.json'},
            { url: '/data/', filename: 'tf-Spikes.json'},
            { url: model.path.slice(2) + '/' + modelHandler.types.predictions + '/' + data.id +'/', filename: 'config.json'},
            { url: model.path.slice(2) + '/' + modelHandler.types.predictions + '/' + data.id +'/', filename: 'ts_16_bin4-256x256_mean3_inverted.json'},
            { url: model.path.slice(2) + '/' + modelHandler.types.predictions + '/' + data.id +'/', filename: 'ts_16_bin4-256x256_mean3_inverted.raw'},
            { url: model.path.slice(2) + '/' + modelHandler.types.predictions + '/' + data.id +'/', filename: 'ts_16_bin4-256x256_predictions-Background.json'},
            { url: model.path.slice(2) + '/' + modelHandler.types.predictions + '/' + data.id +'/', filename: 'ts_16_bin4-256x256_predictions-Background.raw'},
            { url: model.path.slice(2) + '/' + modelHandler.types.predictions + '/' + data.id +'/', filename: 'ts_16_bin4-256x256_predictions-Inner.json'},
            { url: model.path.slice(2) + '/' + modelHandler.types.predictions + '/' + data.id +'/', filename: 'ts_16_bin4-256x256_predictions-Inner.raw'},
            { url: model.path.slice(2) + '/' + modelHandler.types.predictions + '/' + data.id +'/', filename: 'ts_16_bin4-256x256_predictions-Membrane.json'},
            { url: model.path.slice(2) + '/' + modelHandler.types.predictions + '/' + data.id +'/', filename: 'ts_16_bin4-256x256_predictions-Membrane.raw'},
            { url: model.path.slice(2) + '/' + modelHandler.types.predictions + '/' + data.id +'/', filename: 'ts_16_bin4-256x256_predictions-Spikes.json'},
            { url: model.path.slice(2) + '/' + modelHandler.types.predictions + '/' + data.id +'/', filename: 'ts_16_bin4-256x256_predictions-Spikes.raw'}
        ];

        model.predictions.push(data);
        await db.write();

    } catch (err) {
        res.status(500).send(err);
    }
    console.log("Inference started.");
    res.redirect('/api/actions/model-details/' + req.params.id);
});

// Get inference status
actions.get('/inference-status/:id/:inferenceDataId', restrict, async (req, res) => {
    console.log('Getting inference status for model id: ' + req.params.id);
    try {
        const model = models.find((m) => m.id == req.params.id);
        const inferenceData = model.inferenceData.find((d) => d.id == req.params.inferenceDataId);
        let status = nanoOetzi.isInferenceRunning();
        console.log(status);
    } catch (err) {
        res.status(500).send(err);
    }
    console.log("Inference status sent.");
    res.redirect('/api/actions/model-details/' + req.params.id);
});

// Predictions
// Download predictions
actions.get('/download-predictions/:id/:predictionsId', restrict, async (req, res) => {
    console.log('Downloading predictions for model id: ' + req.params.id);
    let data = modelHandler.downloadData(req.params.id, "predictions", req.params.predictionsId);
    res.set('Content-Type', 'application/zio');
    res.set('Content-Disposition', 'attachment; filename=' + "predictions-" + data.name);
    res.send(data.zipBuffer);
});

// Visualizate predictions
actions.get('/visualize-data/:id/:inferenceDataId/:predictionsId', restrict, async (req, res) => {
    console.log*('Model details');
    const model = models.find((m) => m.id == req.params.id);
    const predictions = JSON.stringify(model.predictions.find((p) => p.id == req.params.predictionsId));
    const predictionsObject = model.predictions.find((p) => p.id == req.params.predictionsId);
    res.render('visualize-data', { titile: 'VolWeb', model: model, predictions: predictions, predictionsObject: predictionsObject });
});

// Delete predictions
actions.get('/delete-predictions/:id/:predictionsId', restrict, async (req, res) => {
    console.log('Deleting predictions for model id: ' + req.params.id);
    try {
        modelHandler.deleteData(req.params.id, "predictions", req.params.predictionsId);
        await db.write();
    } catch (err) {
        res.status(500).send(err);
    }
    console.log("Predictions deleted.");
    res.redirect('/api/actions/model-details/' + req.params.id);
});

// Test File Upload
actions.get('/file-upload', restrict, (req, res) => {
    res.render('file-upload');
});


///////////////////////
/////// PROJECTS
///////////////////////
const projectsActionsPath = "projects"

// Get Project List
actions.get(`/${projectsActionsPath}/`, restrict, (req, res) => {
    try {
        const projects = projectController.getUserProjects(req.session.user.id);
        res.render('project-list', { projects: projects });
    } catch (err) {
        res.status(500).send(err);
    }
});

// Get Project Details
actions.get(`/${projectsActionsPath}/details/:id`, restrict, (req, res) => {
    try {
        const project = {
            "details": projectController.getById(req.params.id),
            "volumes": [],
            "models": []
        }
        const volumes = volumeController.getVolumesFromProject(project.details.id)
        for (const volume of volumes) {
            let rawData = null;
            if (volume.rawDataId) {
                rawData = volumeDataController.getById(volume.rawDataId);
            }
            const sparseLabeledVolumes = volumeDataController.getSparseLabeledVolumesFromVolume(volume.id);
            const pseudoLabeledVolumes = volumeDataController.getPseudoLabeledVolumesFromVolume(volume.id);
            project.volumes.push({"details": volume, "rawData": rawData,
                "sparseLabeledVolumes": sparseLabeledVolumes, "pseudoLabeledVolumes": pseudoLabeledVolumes});
        }
        const models = modelController.getModelsFromProject(project.details.id);
        for (const model of models) {
            const checkpoints = checkpointController.getCheckpointsFromModel(model.id);
            project.models.push({"details": model, "checkpoints": checkpoints});
        }

        res.render('project-details', { project: project });
    } catch (err) {
        res.status(500).send(err);
    }
});

// Get Create Project Page
actions.get(`/${projectsActionsPath}/create-project`, restrict, (req, res) => {
    res.render('create-project');
});

// Create New Project
actions.post(`/${projectsActionsPath}/create-project`, restrict, async (req, res) => {
    console.log('Creating a new project');
    try {
        const projectId = await projectController.create(req.body.name, req.body.description, req.session.user.id);

        console.log("Project successfully created.");
        res.redirect(`/api/actions/${projectsActionsPath}/details/${projectId}`);
    } catch (err) {
        console.error("Error in creating project:", err);
        res.status(500).send(err);
    }
});

// Delete Project
actions.get(`/${projectsActionsPath}/delete-project/:id`, restrict, async (req, res) => {
    try {
        await projectController.delete(req.params.id);

        res.redirect(`/api/actions/${projectsActionsPath}/`);
    } catch (err) {
        res.status(500).send(err);
    }
});


/////// VOLUMES

// Create New Volume
actions.post(`/${projectsActionsPath}/:id/create-volume`, restrict, async (req, res) => {
    console.log('Creating a new volume');
    try {
        await volumeController.create(req.body.name, req.body.description, req.session.user.id, req.params.id);

        console.log("Volume successfully created.");
        res.redirect(`/api/actions/${projectsActionsPath}/details/${req.params.id}`);
    } catch (err) {
        console.error("Error in creating volume:", err);
        res.status(500).send(err);
    }
});

// Remove Volume
actions.get(`/${projectsActionsPath}/:idProject/volume/:idVolume/delete`, restrict, async (req, res) => {
    console.log(`Deleting Volume ${req.params.idVolume}`);
    try {
        await volumeController.delete(req.params.idVolume);

        res.redirect(`/api/actions/${projectsActionsPath}/details/${req.params.idProject}`);
    } catch (err) {
        console.error("Error in creating volume:", err);
        res.status(500).send(err);
    }
});

// Upload Raw Data
actions.post(`/${projectsActionsPath}/:idProject/volume/:idVolume/raw-data/upload`, restrict, async (req, res) => {
    console.log(`Uploading raw data for volume ${req.params.idVolume}`);
    try {
        if (!req.files || !req.files.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {
            await volumeController.addRawVolumeFiles(req.params.idVolume, req.session.user.id, req.files.files);
            res.redirect(`/api/actions/${projectsActionsPath}/details/` + req.params.idProject);
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

// Upload Mrc File to Raw Data
actions.post(`/${projectsActionsPath}/:idProject/volume/:idVolume/raw-data/upload-mrc-file`, restrict, async (req, res) => {
    try {
        if (!req.files || !req.files.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {
            await volumeController.addRawVolumeMrcFile(req.params.idVolume, req.session.user.id, req.files.files);
            res.redirect(`/api/actions/${projectsActionsPath}/details/` + req.params.idProject);
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

// Add Sparse Labeled Volume
actions.get(`/${projectsActionsPath}/:idProject/volume/:idVolume/add-sparse-labeled-volume`, restrict, async (req, res) => {
    try {
        await volumeController.addSparseLabeledVolume(req.params.idVolume, req.session.user.id);

        res.redirect(`/api/actions/${projectsActionsPath}/details/${req.params.idProject}`);
    } catch (err) {
        console.error("Error in creating volume:", err);
        res.status(500).send(err);
    }
});

// Add Pseudo Labeled Volume
actions.get(`/${projectsActionsPath}/:idProject/volume/:idVolume/add-pseudo-labeled-volume`, restrict, async (req, res) => {
    try {
        await volumeController.addPseudoLabeledVolume(req.params.idVolume, req.session.user.id);

        res.redirect(`/api/actions/${projectsActionsPath}/details/${req.params.idProject}`);
    } catch (err) {
        console.error("Error in creating volume:", err);
        res.status(500).send(err);
    }
});

// Test Tiff Conversion
actions.get(`/${projectsActionsPath}/:idProject/volume/:idVolume/test-tiff`, restrict, async (req, res) => {
    try {
        await volumeController.testTiffConversion(req.params.idVolume);

        res.redirect(`/api/actions/${projectsActionsPath}/details/${req.params.idProject}`);
    } catch (err) {
        console.error("Error in creating volume:", err);
        res.status(500).send(err);
    }
});

/////// VOLUME DATA

// Visualize Volume Data
actions.get(`/${projectsActionsPath}/:idProject/volumeData/:idVolumeData/visualize`, restrict, async (req, res) => {
    console.log(`Visualizing volume data ${req.params.idVolumeData}`);
    try {
        const volumeData = volumeDataController.getById(req.params.idVolumeData);

        if (!volumeData.rawFile) {
            throw new Error('Visualisation requires the volume data to contain a .raw file.');
        }

        if (!volumeData.settingsFile) {
            throw new Error('Visualisation requires the volume data to contain a settings file.');
        }

        if (volumeData.rawFile.getFileExtension() !== ".raw") {
            throw new Error('Web renderer currently only supports the visualisation of .raw files.');
        }

        const visualizationFiles = [];

        visualizationFiles.push( { path: publicDataPath(req.originalUrl, volumeData.rawFile.filePath), filename: volumeData.rawFile.fileName } );
        visualizationFiles.push( { path: publicDataPath(req.originalUrl, volumeData.settingsFile.filePath), filename: volumeData.settingsFile.fileName } );
        visualizationFiles.push( { path: publicPath(req.originalUrl, "data/session.json"), filename: "session.json" } );
        visualizationFiles.push( { path: publicPath(req.originalUrl, "data/tf-default.json"), filename: "tf-default.json" } );

        const configData = { "files": [] }

        for (let i = 0; i < 5; i++) {
            configData["files"].push(volumeData.settingsFile.fileName);
        }

        const volumesJSON = JSON.stringify(visualizationFiles).replaceAll('\\', '\\\\');
        const configJSON = JSON.stringify(configData);

        res.render('visualize-volume', { volumeName: "test", volumes: volumesJSON, config: configJSON });
    } catch (err) {
        res.status(500).send(err);
    }
});

// Add Files to Volume Data
actions.get(`/${projectsActionsPath}/:idProject/volumeData/:idVolumeData/upload-files`, restrict, async (req, res) => {
    try {
        if (!req.files || !req.files.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {
            await volumeDataController.addFiles(req.params.idVolumeData, req.files.files);
            res.redirect(`/api/actions/${projectsActionsPath}/details/` + req.params.idProject);
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

// Add Mrc File to Volume Data
actions.get(`/${projectsActionsPath}/:idProject/volumeData/:idVolumeData/upload-mrc-file`, restrict, async (req, res) => {
    try {
        if (!req.files || !req.files.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {
            await volumeDataController.addMrcFile(req.params.idVolumeData, req.files.files);
            res.redirect(`/api/actions/${projectsActionsPath}/details/` + req.params.idProject);
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

// Download Volume Data
actions.get(`/${projectsActionsPath}/:idProject/volumeData/:idVolumeData/download-full`, restrict, async (req, res) => {
    console.log(`Downloading volume data ${req.params.idVolumeData}`);
    try {
        const volumeData = volumeDataController.getById(req.params.idVolumeData);
        let data = volumeData.prepareDataForDownload();
        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', 'attachment; filename=' + data.name);
        res.send(data.zipBuffer);
    } catch (err) {
        res.status(500).send(err);
    }
});

actions.get(`/${projectsActionsPath}/:idProject/volumeData/:idVolumeData/download-raw-file`, restrict, async (req, res) => {
    console.log(`Downloading raw data for volume data ${req.params.idVolumeData}`);
    try {
        const rawFile = volumeDataController.getById(req.params.idVolumeData).rawFile;

        if(rawFile == null) {
            throw new Error("Raw volume does not have a raw file");
        }

        let data = rawFile.prepareDataForDownload();
        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', 'attachment; filename=' + data.name);
        res.send(data.zipBuffer);
    } catch (err) {
        res.status(500).send(err);
    }
});

actions.get(`/${projectsActionsPath}/:idProject/volumeData/:idVolumeData/download-settings-file`, restrict, async (req, res) => {
    console.log(`Downloading settings file for volume data ${req.params.idVolumeData}`);
    try {
        const settingsFile = volumeDataController.getById(req.params.idVolumeData).settingsFile;

        if(settingsFile == null) {
            throw new Error("Raw volume does not have a settings file");
        }

        let data = settingsFile.prepareDataForDownload();
        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', 'attachment; filename=' + data.name);
        res.send(data.zipBuffer);
    } catch (err) {
        res.status(500).send(err);
    }
});

actions.get(`/${projectsActionsPath}/:idProject/volumeData/:idVolumeData/download-mrc-file`, restrict, async (req, res) => {
    console.log(`Downloading mrc file for volume data ${req.params.idVolumeData}`);
    try {
        const mrcFile = volumeDataController.getById(req.params.idVolumeData).mrcFile;

        if(mrcFile == null) {
            throw new Error("Raw volume does not have a mrc file");
        }

        let data = mrcFile.prepareDataForDownload();
        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', 'attachment; filename=' + data.name);
        res.send(data.zipBuffer);
    } catch (err) {
        res.status(500).send(err);
    }
});

// Delete Volume Data
actions.get(`/${projectsActionsPath}/:idProject/volumeData/:idVolumeData/delete-full`, restrict, async (req, res) => {
    try {
        await volumeDataController.delete(req.params.idVolumeData);
        res.redirect(`/api/actions/${projectsActionsPath}/details/` + req.params.idProject);
    } catch (err) {
        res.status(500).send(err);
    }
});

actions.get(`/${projectsActionsPath}/:idProject/volumeData/:idVolumeData/delete-raw-file`, restrict, async (req, res) => {
    try {
        await volumeDataController.removeRawFile(req.params.idVolumeData);
        res.redirect(`/api/actions/${projectsActionsPath}/details/` + req.params.idProject);
    } catch (err) {
        res.status(500).send(err);
    }
});

actions.get(`/${projectsActionsPath}/:idProject/volumeData/:idVolumeData/delete-settings-file`, restrict, async (req, res) => {
    try {
        await volumeDataController.removeSettingsFile(req.params.idVolumeData);
        res.redirect(`/api/actions/${projectsActionsPath}/details/` + req.params.idProject);
    } catch (err) {
        res.status(500).send(err);
    }
});

actions.get(`/${projectsActionsPath}/:idProject/volumeData/:idVolumeData/delete-mrc-file`, restrict, async (req, res) => {
    try {
        await volumeDataController.removeMrcFile(req.params.idVolumeData);
        res.redirect(`/api/actions/${projectsActionsPath}/details/` + req.params.idProject);
    } catch (err) {
        res.status(500).send(err);
    }
});

/////// MODELS
// Create New Model
actions.post(`/${projectsActionsPath}/:idProject/create-model`, restrict, async (req, res) => {
    console.log('Creating a new model');
    try {
        await modelController.create(req.body.name, req.body.description, req.session.user.id, req.params.idProject);

        console.log("Model successfully created.");
        res.redirect(`/api/actions/${projectsActionsPath}/details/${req.params.idProject}`);
    } catch (err) {
        console.error("Error in creating volume:", err);
        res.status(500).send(err);
    }
});

// Remove Model
actions.get(`/${projectsActionsPath}/:idProject/model/:idModel/delete`, restrict, async (req, res) => {
    console.log(`Deleting Model ${req.params.idModel}`);
    try {
        await modelController.delete(req.params.idModel);
        res.redirect(`/api/actions/${projectsActionsPath}/details/${req.params.idProject}`);
    } catch (err) {
        console.error("Error in creating model:", err);
        res.status(500).send(err);
    }
});

// Upload new checkpoint
actions.post(`/${projectsActionsPath}/:idProject/model/:idModel/add-checkpoint`, restrict, async (req, res) => {
    try {
        if (!req.files || !req.files.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {
            if (Array.isArray(req.files.files)) {
                for (const file of req.files.files) {
                    await checkpointController.create(file, req.params.idModel, req.session.user.id);
                }
            }
            else {
                await checkpointController.create(req.files.files, req.params.idModel, req.session.user.id);
            }
            res.redirect(`/api/actions/${projectsActionsPath}/details/` + req.params.idProject);
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

// Download checkpoint
actions.get(`/${projectsActionsPath}/:idProject/model/:idModel/checkpoint/:idCheckpoint/download`, restrict, async (req, res) => {
    try {
        const checkpoint = checkpointController.getById(req.params.idCheckpoint);
        let data = checkpoint.prepareDataForDownload();
        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', 'attachment; filename=' + data.name);
        res.send(data.zipBuffer);
    } catch (err) {
        res.status(500).send(err);
    }
});

// Delete checkpoint
actions.get(`/${projectsActionsPath}/:idProject/model/:idModel/checkpoint/:idCheckpoint/delete`, restrict, async (req, res) => {
    try {
        await checkpointController.delete(req.params.idCheckpoint);
        res.redirect(`/api/actions/${projectsActionsPath}/details/` + req.params.idProject);
    } catch (err) {
        res.status(500).send(err);
    }
});

// Vizualization test
actions.get(`/visualization-test`, async (req, res) => {
    try {
        const basePath = "../../ts_16_256/"
        const files256 =  [
            'config.json',
            'tf-bg.json',
            'tf-in.json',
            'tf-memb.json',
            'tf-raw.json',
            'tf-spike.json',
            'ts_16_bin4-256x256.json',
            'ts_16_bin4-256x256.raw',
            // 'ts_16_bin4-uint8-inv-mean-3-256x256.json',
            // 'ts_16_bin4-uint8-inv-mean-3-256x256.raw',
            // 'ts_16_predictions-Background-256x256.json',
            // 'ts_16_predictions-Background-256x256.raw',
            // 'ts_16_predictions-Inner-256x256.json',
            // 'ts_16_predictions-Inner-256x256.raw',
            // 'ts_16_predictions-Membrane-256x256.json',
            // 'ts_16_predictions-Membrane-256x256.raw',
            // 'ts_16_predictions-Spikes-256x256.json',
            // 'ts_16_predictions-Spikes-256x256.raw'
        ];

        const volumes = [];
        for (const file of files256) {
            const fileObj = { path: path.join(basePath, file), filename: file };
            volumes.push(fileObj);
        }
        volumes.push({ path: "../../data/session.json", filename: "session.json" })

        const volumesJSON = JSON.stringify(volumes).replaceAll('\\', '\\\\');

        res.render('visualize-volume', { volumeName: "test", volumes: volumesJSON });
    } catch (err) {
        res.status(500).send(err);
    }
});