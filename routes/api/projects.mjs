// @ts-check

import express from 'express';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import IlastikHandler from '../../tools/ilastik-handler.mjs';
import NanoOetziHandler from '../../tools/nano-oetzi-handler.mjs';
import { restrictApi } from '../../middleware/restrict.mjs';
import appConfig from "../../tools/config.mjs";
import ProjectController from '../../controllers-api/project-controller.mjs';
import VolumeController from '../../controllers-api/volume-controller.mjs';
import VolumeDataController from '../../controllers-api/volume-data-controller.mjs';
import { VolumeDataType } from '../../models/volume-data-factory.mjs';
import ModelController from '../../controllers-api/model-controller.mjs';
import CheckpointController from '../../controllers-api/checkpoint-controller.mjs';
import ResultController from '../../controllers-api/result-controller.mjs';
import IlastikController from '../../controllers-api/ilastik-controller.mjs';
import NanoOetziController from '../../controllers-api/nano-oetzi-controller.mjs';
import UserController from '../../controllers-api/user-controller.mjs';
import { logErrors, clientErrorHandler } from '../../tools/error-handler.mjs'
import toAsyncRouter from 'async-express-decorator'

// Config
const config = appConfig;
const ilastikHandler = new IlastikHandler(config.ilastik);
const nanoOetzi = new NanoOetziHandler(config.nanoOetzi);

// toAsyncRouter removes the need to call next() on async errors.
export const projectsApi = toAsyncRouter(express.Router());

projectsApi.use(cors());
projectsApi.use(fileUpload({ createParentPath: true }));

///////////////////////
/////// AUTHENTICATION
///////////////////////

projectsApi.post('/login', UserController.login);
projectsApi.post('/logout', UserController.logout);

///////////////////////
/////// PROJECTS
///////////////////////

// Get Project List
projectsApi.get(`/projects`, restrictApi, ProjectController.getAllUserProjects);

// Create New Project
projectsApi.post(`/projects`, restrictApi, ProjectController.createProject);

// Get Project
projectsApi.get(`/project/:idProject`, restrictApi, ProjectController.getProject);

// Delete Project
projectsApi.delete(`/project/:idProject`, restrictApi, ProjectController.deleteProject);

/////// ILASTIK

// Get Ilastik task queue
projectsApi.get(`/ilastik-task-queue`, restrictApi,
    async (req, res) => IlastikController.getIlastikTaskQueue(ilastikHandler, req, res));

// Get Ilastik task history
projectsApi.get(`/ilastik-task-history`, restrictApi,
    async (req, res) => IlastikController.getIlastikUserTaskHistory(ilastikHandler, req, res));

// Run Ilastik inference
projectsApi.post(`/project/:idProject/volume/:idVolume/create-pseudo-labels`, restrictApi,
    async (req, res) => IlastikController.queuePseudoLabelsGeneration(ilastikHandler, req, res));

/////// NANO OETZI

// Get Nano Oetzi task queue
projectsApi.get(`/nanooetzi-task-queue`, restrictApi,
    async (req, res) => NanoOetziController.getNanoOetziTaskQueue(nanoOetzi, req, res));

// Get Nano Oetzi task history
projectsApi.get(`/nanooetzi-task-history`, restrictApi,
    async (req, res) => NanoOetziController.getNanoOetziUserTaskHistory(nanoOetzi, req, res));

// Inference
projectsApi.post(`project/:idProject/queue-inference`, restrictApi,
    async (req, res) => NanoOetziController.queueInference(nanoOetzi, req, res));

// Run training
projectsApi.post(`project/:idProject/queue-training`, restrictApi, 
    async (req, res) => NanoOetziController.queueTraining(nanoOetzi, req, res));

/////// VOLUMES

// Get Volumes from project
projectsApi.get(`/project/:idProject/volumes`, restrictApi, VolumeController.getVolumesFromProject);

// Create New Volume
projectsApi.post(`/project/:idProject/volumes`, restrictApi, VolumeController.createVolume);

// Get Volume
projectsApi.get(`/project/:idProject/volume/:idVolume`, restrictApi, VolumeController.getVolume);

// Get Volume Details
projectsApi.get(`/project/:idProject/volume/:idVolume/details`, restrictApi, VolumeController.getVolumeDetails);

// Remove Volume
// actions.get(`/:idProject/volume/:idVolume/delete`, restrictApi, VolumeController.removeVolume);
projectsApi.delete(`/project/:idProject/volume/:idVolume`, restrictApi, VolumeController.removeFromProject);

// Upload Raw Data
projectsApi.put(`/project/:idProject/volume/:idVolume/raw-data/upload`, VolumeController.uploadRawData);

// Upload Mrc File to Raw Data
projectsApi.put(`/project/:idProject/volume/:idVolume/raw-data/upload-mrc`, restrictApi, VolumeController.uploadMrcFile);

// Add Sparse Labeled Volume
projectsApi.put(`/project/:idProject/volume/:idVolume/add-sparse-label-volume`, restrictApi, VolumeController.addSparseLabelVolume);

// Add Pseudo Labeled Volume
projectsApi.put(`/project/:idProject/volume/:idVolume/add-pseudo-label-volume`, restrictApi, VolumeController.addPseudoLabelVolume);

// Process Sparse Labels
projectsApi.put(`/:idProject/volume/:idVolume/add-annotations`, restrictApi, 
    async (req, res) => VolumeController.addAnnotations(req, res));

/////// VOLUME DATA

// Get Raw Data
projectsApi.get(`/project/:idProject/volume/:idVolume/volumeData/:type/:idVolumeData`, restrictApi, 
    async (req, res) => VolumeDataController.getById(VolumeDataType.mapName(req.params.type), req, res));

// Visualize
projectsApi.get(`/:idProject/volume/:idVolume/volumeData/:type/:idVolumeData/visualize`, restrictApi, 
    async (req, res) => VolumeDataController.visualizeSingleVolume(VolumeDataType.mapName(req.params.type), req, res));

// Add Files to Volume Data
projectsApi.put(`/volumeData/:type/:idVolumeData/upload-files`, restrictApi, 
    async (req, res) => (VolumeDataController.addFiles(VolumeDataType.mapName(req.params.type), req, res)));

// Add Mrc File to Volume Data
// projectsApi.post(`/:idProject/volumeData/:type/:idVolumeData/upload-mrc-file`, 
//     async (req, res) => VolumeDataController.addMrcFile(VolumeDataType.mapName(req.params.type), req, res));

// Download Raw Volume Data
projectsApi.get(`/project/:idProject/volume/:idVolume/volumeData/:type/:idVolumeData/download-full`, restrictApi, 
    async (req, res) => VolumeDataController.downloadFullVolumeData(VolumeDataType.mapName(req.params.type), req, res));

projectsApi.get(`/project/:idProject/volume/:idVolume/volumeData/:type/:idVolumeData/download-raw-file`, restrictApi,
    async (req, res) => VolumeDataController.downloadRawFile(VolumeDataType.mapName(req.params.type), req, res));

projectsApi.get(`/project/:idProject/volume/:idVolume/volumeData/:type/:idVolumeData/download-settings-file`, restrictApi, 
    async (req, res) => VolumeDataController.downloadSettingsFile(VolumeDataType.mapName(req.params.type), req, res));

projectsApi.get(`/project/:idProject/volume/:idVolume/volumeData/:type/:idVolumeData/download-mrc-file`, restrictApi, 
    async (req, res) => VolumeDataController.downloadMrcFile(VolumeDataType.mapName(req.params.type), req, res));

// Delete Volume Data
// actions.get(`/:idProject/volumeData/:type/:idVolumeData/delete-full`, restrictApi, 
//     async (req, res) => VolumeDataController.deleteFullVolumeData(VolumeDataType.mapName(req.params.type), req, res));
projectsApi.delete(`/project/:idProject/volume/:idVolume/volumeData/:type/:idVolumeData`, restrictApi, 
    async (req, res) => VolumeDataController.removeFromVolume(VolumeDataType.mapName(req.params.type), req, res));

// projectsApi.get(`/:idProject/volumeData/:type/:idVolumeData/delete-raw-file`, restrictApi, 
//     async (req, res) => VolumeDataController.removeRawFile(VolumeDataType.mapName(req.params.type), req, res));

// projectsApi.get(`/:idProject/volumeData/:type/:idVolumeData/delete-mrc-file`, restrictApi, 
//     async (req, res) => VolumeDataController.removeMrcFile(VolumeDataType.mapName(req.params.type), req, res));
  
/////// MODELS

// Get Models from Project
projectsApi.post(`/project/:idProject/models`, restrictApi, ModelController.getModelsFromProject);

// Create New Model
projectsApi.post(`/project/:idProject/models`, restrictApi, ModelController.createModel);

// Get Model
projectsApi.get(`/project/:idProject/model/:idModel`, restrictApi, ModelController.getModel);

// Get Model Details
projectsApi.get(`/project/:idProject/model/:idModel/details`, restrictApi, ModelController.getModelDetails);

// Remove Model
// actions.get(`/:idProject/model/:idModel/delete`, restrictApi, ModelController.removeModel);
projectsApi.get(`/project/:idProject/model/:idModel/removeFromProject`, restrictApi, ModelController.removeFromProject);

/////// CHECKPOINTS

// Get checkpoint info
projectsApi.get(`/project/:idProject/model/:idModel/checkpoint/:idCheckpoint`, restrictApi, CheckpointController.getCheckpoint);

// Delete checkpoint
// actions.get(`/:idProject/model/:idModel/checkpoint/:idCheckpoint/delete`, restrictApi, CheckpointController.deleteCheckpoint);
projectsApi.delete(`/project/:idProject/model/:idModel/checkpoint/:idCheckpoint`, restrictApi, CheckpointController.removeFromModel);

// Upload new checkpoint
projectsApi.post(`/project/:idProject/model/:idModel/add-checkpoint`, restrictApi, CheckpointController.uploadCheckpoints);

// Download checkpoint
projectsApi.get(`/project/:idProject/model/:idModel/checkpoint/:idCheckpoint/download`, CheckpointController.downloadCheckpoint);

/////// RESULTS
// Remove Result
// actions.get(`/:idProject/result/:idResult/delete`, restrictApi, ResultController.deleteResult);
projectsApi.delete(`/project/:idProject/volume/:idVolume/result/:idResult`, restrictApi, ResultController.removeFromVolume);

// Download Result
projectsApi.get(`/project/:idProject/result/:idResult/download`, restrictApi, ResultController.downloadResult);

// Download Result File
projectsApi.get(`/project/:idProject/result/:idResult/download/:fileIndex`, restrictApi, ResultController.downloadResultFile);

projectsApi.use(logErrors)
projectsApi.use(clientErrorHandler)