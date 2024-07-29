import express from 'express';
import DatabaseManager from "../../tools/lowdb-manager.mjs";
import { spawn } from 'child_process';
import path from 'path';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import { DateHandler } from '../../tools/date-handler.mjs';
import  * as fileSystem from 'fs';
import { IlastikHandler } from '../../tools/ilastik-handler.mjs';
import { NanoOetziHandler } from '../../tools/nano-oetzi-handler.mjs';
import { restrict } from '../../middleware/restrict.mjs';
import { ModelHandler } from '../../tools/model-handler.mjs';
import * as fs from 'fs';
import { Project } from '../../models/project.mjs';
import { ModelFactory } from "../../models/model-factory.mjs";

// Config
const config = JSON.parse(fileSystem.readFileSync('config.json', 'utf8'));
const ilastik = new IlastikHandler(config.ilastik);
const nanoOetzi = new NanoOetziHandler(config.nanoOetzi);

// DB connection
const db = DatabaseManager.db;
const models = db.data.models;
const modelHandler = new ModelHandler(config.models, models);

const projectModel = ModelFactory.createProjectModel(config.db.type, config.projects);

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
    res.send("Ilastik version: " + ilastik.getVersion());
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
        const projects = projectModel.getUserProjects(req.session.user.id);
        res.render('project-list', { projects: projects });
    } catch (err) {
        res.status(500).send(err);
    }
});

// Get Project Details
actions.get(`/${projectsActionsPath}/details/:id`, restrict, (req, res) => {
    try {
        const project = projectModel.getById(req.params.id);
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
        const project = Project.createProject(req.body.name, req.body.description, req.session.user.id);
        await projectModel.create(project);

        console.log("Project successfully created.");
        res.redirect(`/api/actions/${projectsActionsPath}/details/` + project.id);
    } catch (err) {
        console.error("Error in creating project:", err);
        res.status(500).send(err);
    }
});

// Delete Project
actions.get(`/${projectsActionsPath}/delete-project/:id`, restrict, async (req, res) => {
    try {
        await projectModel.delete(req.params.id);
        res.redirect(`/api/actions/${projectsActionsPath}/`);
    } catch (err) {
        res.status(500).send(err);
    }
});

// Create New Volume
actions.post(`/${projectsActionsPath}/:id/create-volume`, restrict, async (req, res) => {
    console.log('Creating a new volume');
    try {
        await projectModel.addVolume(req.params.id, req.body.name, req.body.description);

        console.log("Volume successfully created.");
        res.redirect(`/api/actions/${projectsActionsPath}/details/` + req.params.id);
    } catch (err) {
        console.error("Error in creating volume:", err);
        res.status(500).send(err);
    }
});

// Remove Volume
actions.get(`/${projectsActionsPath}/:idProject/volume/:idVolume/delete`, restrict, async (req, res) => {
    console.log(`Deleting Volume ${req.params.idVolume}`);
    try {
        await projectModel.removeVolume(req.params.idProject, req.params.idVolume);
        res.redirect(`/api/actions/${projectsActionsPath}/details/` + req.params.idProject);
    } catch (err) {
        console.error("Error in creating volume:", err);
        res.status(500).send(err);
    }
});

// Upload Raw Data
actions.post(`/${projectsActionsPath}/:idProject/volume/:idVolume/upload-raw-data`, restrict, async (req, res) => {
    console.log(`Uploading raw data for volume ${req.params.idVolume} (project id: ${req.params.idProject})`);
    try {
        if (!req.files || !req.files.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {
            await projectModel.addRawVolume(req.params.idProject, req.params.idVolume, req.files.files);
            res.redirect(`/api/actions/${projectsActionsPath}/details/` + req.params.idProject);
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

// Download Raw Data
actions.get(`/${projectsActionsPath}/:idProject/volume/:idVolume/raw-data`, restrict, async (req, res) => {
    console.log(`Downloading raw data for volume ${req.params.idVolume} (project ${req.params.idProject})`);
    try {
        const rawVolume = projectModel.getRawVolume(req.params.idProject, req.params.idVolume);
        let data = projectModel.prepareDataForDownload(rawVolume);
        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', 'attachment; filename=' + data.name);
        res.send(data.zipBuffer);
    } catch (err) {
        res.status(500).send(err);
    }
});

// Delete Raw Data
actions.get(`/${projectsActionsPath}/:idProject/volume/:idVolume/delete-raw-data`, restrict, async (req, res) => {
    console.log(`Deleting raw data for volume ${req.params.idVolume} (project ${req.params.idProject})`);
    try {
        await projectModel.removeRawVolume(req.params.idProject, req.params.idVolume);
        res.redirect(`/api/actions/${projectsActionsPath}/details/` + req.params.idProject);
    } catch (err) {
        res.status(500).send(err);
    }
});

// Upload Sparse Labels
actions.post(`/${projectsActionsPath}/:idProject/volume/:idVolume/upload-sparse-labels`, restrict, async (req, res) => {
    console.log(`Uploading Sparse Data for volume ${req.params.idVolume} (project id: ${req.params.idProject})`);
    try {
        if (!req.files || !req.files.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {
            await projectModel.addSparseLabeledVolumes(req.params.idProject, req.params.idVolume, req.files.files);
            res.redirect(`/api/actions/${projectsActionsPath}/details/` + req.params.idProject);
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

// Download Sparse Label
actions.get(`/${projectsActionsPath}/:idProject/volume/:idVolume/sparse_labels/:idSparseLabels/download`, restrict, async (req, res) => {
    console.log(`Downloading sparse labeled volume ${req.params.idSparseLabels} for volume ${req.params.idVolume} (project ${req.params.idProject})`);
    try {
        const sparseLabeledVolume = projectModel
            .getSparseLabeledVolume(req.params.idProject, req.params.idVolume, req.params.idSparseLabels);
        let data = projectModel.prepareDataForDownload(sparseLabeledVolume);
        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', 'attachment; filename=' + data.name);
        res.send(data.zipBuffer);
    } catch (err) {
        res.status(500).send(err);
    }
});

// Delete Sparse Labels
actions.get(`/${projectsActionsPath}/:idProject/volume/:idVolume/sparse_labels/:idSparseLabels/delete`, restrict, async (req, res) => {
    console.log(`Deleting sparse labeled volume ${req.params.idSparseLabels} for volume ${req.params.idVolume} (project ${req.params.idProject})`);
    try {
        await projectModel.removeSparseLabeledVolume(req.params.idProject, req.params.idVolume, req.params.idSparseLabels);
        res.redirect(`/api/actions/${projectsActionsPath}/details/` + req.params.idProject);
    } catch (err) {
        res.status(500).send(err);
    }
});

// Upload Pseudo Labels
actions.post(`/${projectsActionsPath}/:idProject/volume/:idVolume/upload-pseudo-labels`, restrict, async (req, res) => {
    console.log(`Uploading Sparse Data for volume ${req.params.idVolume} (project id: ${req.params.idProject})`);
    try {
        if (!req.files || !req.files.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {
            await projectModel.addPseudoLabeledVolumes(req.params.idProject, req.params.idVolume, req.files.files);
            res.redirect(`/api/actions/${projectsActionsPath}/details/` + req.params.idProject);
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

// Download Pseudo Label
actions.get(`/${projectsActionsPath}/:idProject/volume/:idVolume/pseudo_labels/:idPseudoLabels`, restrict, async (req, res) => {
    console.log(`Downloading pseudo labeled volume ${req.params.idPseudoLabels} for volume ${req.params.idVolume} (project ${req.params.idProject})`);
    try {
        const pseudoLabeledVolume = projectModel
            .getPseudoLabeledVolume(req.params.idProject, req.params.idVolume, req.params.idPseudoLabels);
        let data = projectModel.prepareDataForDownload(pseudoLabeledVolume);
        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', 'attachment; filename=' + data.name);
        res.send(data.zipBuffer);
    } catch (err) {
        res.status(500).send(err);
    }
});

// Delete Pseudo Labels
actions.get(`/${projectsActionsPath}/:idProject/volume/:idVolume/pseudo_labels/:idPseudoLabels/delete`, restrict, async (req, res) => {
    console.log(`Deleting sparse labeled volume ${req.params.idPseudoLabels} for volume ${req.params.idVolume} (project ${req.params.idProject})`);
    try {
        await projectModel.removePseudoLabeledVolume(req.params.idProject, req.params.idVolume, req.params.idPseudoLabels);
        res.redirect(`/api/actions/${projectsActionsPath}/details/` + req.params.idProject);
    } catch (err) {
        res.status(500).send(err);
    }
});

// Create New Model
actions.post(`/${projectsActionsPath}/:id/create-model`, restrict, async (req, res) => {
    console.log('Creating a new model');
    try {
        await projectModel.addModel(req.params.id, req.body.name, req.body.description);

        console.log("Model successfully created.");
        res.redirect(`/api/actions/${projectsActionsPath}/details/` + req.params.id);
    } catch (err) {
        console.error("Error in creating volume:", err);
        res.status(500).send(err);
    }
});

// Remove Volume
actions.get(`/${projectsActionsPath}/:idProject/model/:idModel/delete`, restrict, async (req, res) => {
    console.log(`Deleting Model ${req.params.idModel}`);
    try {
        await projectModel.removeModel(req.params.idProject, req.params.idModel);
        res.redirect(`/api/actions/${projectsActionsPath}/details/` + req.params.idProject);
    } catch (err) {
        console.error("Error in creating model:", err);
        res.status(500).send(err);
    }
});