import express from 'express';
import DatabaseManager from "../../tools/lowdb-manager.mjs";
import { spawn } from 'child_process';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import { IlastikHandler } from '../../tools/ilastik-handler.mjs';
import { NanoOetziHandler } from '../../tools/nano-oetzi-handler.mjs';
import { restrict } from '../../middleware/restrict.mjs';
import appConfig from "../../tools/config.mjs";
import { ProjectController } from '../../controllers/project-controller.mjs';
import { VolumeController } from '../../controllers/volume-controller.mjs';
import { VolumeDataController } from '../../controllers/volume-data-controller.mjs';
import { VolumeDataType } from '../../models/volume-data-factory.mjs';
import { ModelController } from '../../controllers/model-controller.mjs';
import { CheckpointController } from '../../controllers/checkpoint-controller.mjs';
import { ResultController } from '../../controllers/result-controller.mjs';

// Config
const config = appConfig;
const ilastikHandler = new IlastikHandler(config.ilastik);
const nanoOetzi = new NanoOetziHandler(config.nanoOetzi);

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

//// ***** END of TEST actions ***** ////

///////////////////////
/////// PROJECTS
///////////////////////
const projectsActionsPath = "projects"

// Get Project List
actions.get(`/${projectsActionsPath}/`, restrict, ProjectController.getAllUserProjects);

// Get Project Details
actions.get(`/${projectsActionsPath}/details/:id`, restrict, ProjectController.getProjectDetails);

// Get Create Project Page
actions.get(`/${projectsActionsPath}/create-project`, restrict, (req, res) => {
    res.render('create-project');
});

// Create New Project
actions.post(`/${projectsActionsPath}/create-project`, restrict, ProjectController.createProject);

// Delete Project
actions.get(`/${projectsActionsPath}/delete-project/:id`, restrict, ProjectController.deleteProject);


/////// VOLUMES

// Create New Volume
actions.post(`/${projectsActionsPath}/:id/create-volume`, restrict, VolumeController.createVolume);

// Remove Volume
actions.get(`/${projectsActionsPath}/:idProject/volume/:idVolume/delete`, restrict, VolumeController.removeVolume);

// Upload Raw Data
actions.post(`/${projectsActionsPath}/:idProject/volume/:idVolume/raw-data/upload`, VolumeController.uploadRawData);

// Upload Mrc File to Raw Data
actions.post(`/${projectsActionsPath}/:idProject/volume/:idVolume/raw-data/upload-mrc-file`, restrict, VolumeController.uploadMrcFile);

// Add Sparse Labeled Volume
actions.get(`/${projectsActionsPath}/:idProject/volume/:idVolume/add-sparse-labeled-volume`, restrict, VolumeController.addSparseLabeledVolume);

// Add Pseudo Labeled Volume
actions.get(`/${projectsActionsPath}/:idProject/volume/:idVolume/add-pseudo-labeled-volume`, restrict, VolumeController.addPseudoLabeledVolume);

// Test Tiff Conversion
actions.get(`/${projectsActionsPath}/:idProject/volume/:idVolume/test-tiff`, restrict, VolumeController.testTiffConversion);

/////// RAW VOLUME DATA

// Visualize Raw Volume Data
actions.get(`/${projectsActionsPath}/:idProject/volumeData/:type/:idVolumeData/visualize`, restrict, 
    async (req, res) => VolumeDataController.visualizeSingleVolume(VolumeDataType.mapName(req.params.type), req, res));

// Add Files to Volume Data
actions.post(`/${projectsActionsPath}/:idProject/volumeData/:type/:idVolumeData/upload-files`, restrict, 
    async (req, res) => (VolumeDataController.addFiles(VolumeDataType.mapName(req.params.type), req, res)));

// Add Mrc File to Volume Data
actions.post(`/${projectsActionsPath}/:idProject/volumeData/:type/:idVolumeData/upload-mrc-file`, 
    async (req, res) => VolumeDataController.addMrcFile(VolumeDataType.mapName(req.params.type), req, res));

// Download Raw Volume Data
actions.get(`/${projectsActionsPath}/:idProject/volumeData/:type/:idVolumeData/download-full`, restrict, 
    async (req, res) => VolumeDataController.downloadFullVolumeData(VolumeDataType.mapName(req.params.type), req, res));

actions.get(`/${projectsActionsPath}/:idProject/volumeData/:type/:idVolumeData/download-raw-file`, restrict,
    async (req, res) => VolumeDataController.downloadRawFile(VolumeDataType.mapName(req.params.type), req, res));

actions.get(`/${projectsActionsPath}/:idProject/volumeData/:type/:idVolumeData/download-settings-file`, restrict, 
    async (req, res) => VolumeDataController.downloadSettingsFile(VolumeDataType.mapName(req.params.type), req, res));

actions.get(`/${projectsActionsPath}/:idProject/volumeData/:type/:idVolumeData/download-mrc-file`, restrict, 
    async (req, res) => VolumeDataController.downloadMrcFile(VolumeDataType.mapName(req.params.type), req, res));

// Delete Volume Data
actions.get(`/${projectsActionsPath}/:idProject/volumeData/:type/:idVolumeData/delete-full`, restrict, 
    async (req, res) => VolumeDataController.deleteFullVolumeData(VolumeDataType.mapName(req.params.type), req, res));

actions.get(`/${projectsActionsPath}/:idProject/volumeData/:type/:idVolumeData/delete-raw-file`, restrict, 
    async (req, res) => VolumeDataController.removeRawFile(VolumeDataType.mapName(req.params.type), req, res));

actions.get(`/${projectsActionsPath}/:idProject/volumeData/:type/:idVolumeData/delete-settings-file`, restrict, 
    async (req, res) => VolumeDataController.removeSettingsFile(VolumeDataType.mapName(req.params.type), req, res));

actions.get(`/${projectsActionsPath}/:idProject/volumeData/:type/:idVolumeData/delete-mrc-file`, restrict, 
    async (req, res) => VolumeDataController.removeMrcFile(VolumeDataType.mapName(req.params.type), req, res));

/////// MODELS
// Create New Model
actions.post(`/${projectsActionsPath}/:idProject/create-model`, restrict, ModelController.createModel);

// Remove Model
actions.get(`/${projectsActionsPath}/:idProject/model/:idModel/delete`, restrict, ModelController.removeModel);

/////// CHECKPOINTS

// Upload new checkpoint
actions.post(`/${projectsActionsPath}/:idProject/model/:idModel/add-checkpoint`, restrict, CheckpointController.uploadCheckpoints);

// Download checkpoint
actions.get(`/${projectsActionsPath}/:idProject/model/:idModel/checkpoint/:idCheckpoint/download`, CheckpointController.downloadCheckpoint);

// Delete checkpoint
actions.get(`/${projectsActionsPath}/:idProject/model/:idModel/checkpoint/:idCheckpoint/delete`, restrict, CheckpointController.deleteCheckpoint);

/////// RESULTS
// Remove Result
actions.get(`/${projectsActionsPath}/:idProject/result/:idResult/delete`, restrict, ResultController.deleteResult);

// Download Result
actions.get(`/${projectsActionsPath}/:idProject/result/:idResult/download`, restrict, ResultController.downloadResult);

// Download Result File
actions.get(`/${projectsActionsPath}/:idProject/result/:idResult/download/:fileIndex`, restrict, ResultController.downloadResultFile);

// Inference test
actions.get(`/inference-test/:idVolumeData/:idCheckpoint`, restrict,
    async (req, res) => ResultController.runInference(nanoOetzi, req, res));

// // Ilastik Inference test
// actions.get(`/ilastik-test`, async (req, res) => {
//     try {
//         await volumeController.createPseudoLabels(1, ilastikHandler);
//     } catch (err) {
//         console.log(err)
//         res.status(500).send(err);
//     }
// });