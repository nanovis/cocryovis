// @ts-check

import express, { Router } from 'express';
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
import toAsyncRouter from 'async-express-decorator'

// Config
const config = appConfig;
const ilastikHandler = new IlastikHandler(config.ilastik);
const nanoOetzi = new NanoOetziHandler(config.nanoOetzi);

// toAsyncRouter removes the need to call next() on async errors.
/** @type {Router} */
export const projectsApi = toAsyncRouter(express.Router());

///////////////////////
/////// USER
///////////////////////

projectsApi.post('/login', UserController.login);
projectsApi.post('/logout', UserController.logout);
projectsApi.post('/register', UserController.register);
projectsApi.get('/getLoggedUserData', restrictApi, UserController.getLoggedUserData);

projectsApi.get(`/status`, restrictApi, 
    async (req, res) => UserController.getStatus(ilastikHandler, nanoOetzi, req, res));

///////////////////////
/////// PROJECTS
///////////////////////

// Get Project List
projectsApi.get(`/projects`, restrictApi, ProjectController.getAllUserProjects);

// Create New Project
projectsApi.post(`/projects`, restrictApi, ProjectController.createProject);

// Get Project
projectsApi.get(`/project/:idProject`, restrictApi, ProjectController.getProject);

// Deep Clone Project
projectsApi.post(`/project/:idProject/deep-clone`, restrictApi, ProjectController.deepCloneProject);

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
projectsApi.post(`/volume/:idVolume/queue-pseudo-label-generation`, restrictApi,
    async (req, res) => IlastikController.queuePseudoLabelsGeneration(ilastikHandler, req, res));

/////// NANO OETZI

// Get Nano Oetzi task queue
projectsApi.get(`/nanooetzi-task-queue`, restrictApi,
    async (req, res) => NanoOetziController.getNanoOetziTaskQueue(nanoOetzi, req, res));

// Get Nano Oetzi task history
projectsApi.get(`/nanooetzi-task-history`, restrictApi,
    async (req, res) => NanoOetziController.getNanoOetziUserTaskHistory(nanoOetzi, req, res));

// Inference
projectsApi.post(`/queue-inference`, restrictApi,
    async (req, res) => NanoOetziController.queueInference(nanoOetzi, req, res));

// Run training
projectsApi.post(`/queue-training`, restrictApi, 
    async (req, res) => NanoOetziController.queueTraining(nanoOetzi, req, res));

/////// VOLUMES

// Get Volumes from project
projectsApi.get(`/project/:idProject/volumes`, restrictApi, VolumeController.getVolumesFromProject);

// Create New Volume
projectsApi.post(`/project/:idProject/volumes`, restrictApi, VolumeController.createVolume);

// Clone Volume
projectsApi.post(`/project/:idProject/volume/:idVolume/clone`, restrictApi, VolumeController.cloneVolume);

// Get Volume
projectsApi.get(`/volume/:idVolume`, restrictApi, VolumeController.getVolume);

// Remove Volume
projectsApi.delete(`/project/:idProject/volume/:idVolume`, restrictApi, VolumeController.removeFromProject);

// Process Sparse Labels
projectsApi.put(`/volume/:idVolume/add-annotations`, restrictApi, 
    async (req, res) => VolumeController.addAnnotations(req, res));

/////// VOLUME DATA

// Get Raw Data
projectsApi.get(`/volumeData/:type/:idVolumeData`, restrictApi, 
    async (req, res) => VolumeDataController.getById(VolumeDataType.mapName(req.params.type), req, res));

// Get Raw Data Files
projectsApi.get(`/volumeData/:type/:idVolumeData/data`, restrictApi,
    async (req, res) => VolumeDataController.getData(VolumeDataType.mapName(req.params.type), req, res));
    
// Visualize
projectsApi.get(`/volumeData/:type/:idVolumeData/visualization-data`, restrictApi, 
    async (req, res) => VolumeDataController.getVolumeVisualizationFiles(VolumeDataType.mapName(req.params.type), req, res));

// Create from Files
projectsApi.post(`/volume/:idVolume/volumeData/:type/from-files`, restrictApi, 
    async (req, res) => (VolumeDataController.createFromFiles(VolumeDataType.mapName(req.params.type), req, res)));

// Create from Mrc File
projectsApi.post(`/volume/:idVolume/volumeData/:type/from-mrc-file`, restrictApi,
    async (req, res) => (VolumeDataController.createFromMrcFile(VolumeDataType.mapName(req.params.type), req, res)));

// Download Raw Volume Data
projectsApi.get(`/volumeData/:type/:idVolumeData/download-full`, restrictApi, 
    async (req, res) => VolumeDataController.downloadFullVolumeData(VolumeDataType.mapName(req.params.type), req, res));

projectsApi.get(`/volumeData/:type/:idVolumeData/download-raw-file`, restrictApi,
    async (req, res) => VolumeDataController.downloadRawFile(VolumeDataType.mapName(req.params.type), req, res));

projectsApi.get(`/volumeData/:type/:idVolumeData/download-settings-file`, restrictApi, 
    async (req, res) => VolumeDataController.downloadSettingsFile(VolumeDataType.mapName(req.params.type), req, res));

projectsApi.get(`/volumeData/:type/:idVolumeData/download-mrc-file`, restrictApi, 
    async (req, res) => VolumeDataController.downloadMrcFile(VolumeDataType.mapName(req.params.type), req, res));

// Delete Volume Data
projectsApi.delete(`/volume/:idVolume/volumeData/:type/:idVolumeData`, restrictApi, 
    async (req, res) => VolumeDataController.removeFromVolume(VolumeDataType.mapName(req.params.type), req, res));
  
/////// MODELS

// Get Models from Project
projectsApi.get(`/project/:idProject/models`, restrictApi, ModelController.getModelsFromProject);

// Create New Model
projectsApi.post(`/project/:idProject/models`, restrictApi, ModelController.createModel);

// Clone Model
projectsApi.post(`/project/:idProject/model/:idModel/clone`, restrictApi, ModelController.cloneModel);

// Get Model
projectsApi.get(`/model/:idModel`, restrictApi, ModelController.getModel);

// Remove Model
projectsApi.delete(`/project/:idProject/model/:idModel`, restrictApi, ModelController.removeFromProject);

/////// CHECKPOINTS

// Get checkpoint info
projectsApi.get(`/checkpoint/:idCheckpoint`, restrictApi, CheckpointController.getCheckpoint);

// Delete checkpoint
projectsApi.delete(`/model/:idModel/checkpoint/:idCheckpoint`, restrictApi, CheckpointController.removeFromModel);

// Get checkpoints from model
projectsApi.get(`/model/:idModel/checkpoints`, restrictApi, CheckpointController.getCheckpointsFromModel);

// Upload new checkpoints
projectsApi.post(`/model/:idModel/checkpoints`, restrictApi, CheckpointController.uploadCheckpoints);

// Download checkpoint
projectsApi.get(`/checkpoint/:idCheckpoint/download`, restrictApi, CheckpointController.downloadCheckpoint);

// Download checkpoint
projectsApi.get(`/checkpoint/:idCheckpoint/as-text`, restrictApi, CheckpointController.checkpointToText);

// Convert checkpoint to text
projectsApi.post(`/checkpoint/to-text`, CheckpointController.checkpointFileToText);

/////// RESULTS
// Get Result
projectsApi.get(`/result/:idResult`, restrictApi, ResultController.getById);

// Get Result Details
projectsApi.get(`/result/:idResult/details`, restrictApi, ResultController.getDetails);

// Get Results From Volume
projectsApi.get(`/volume/:idVolume/results`, restrictApi, ResultController.getFromVolume);

// Create Result from Fules
projectsApi.post(`/volume/:idVolume/results`, restrictApi, ResultController.createFromFiles);

// Remove Result
projectsApi.delete(`/volume/:idVolume/result/:idResult`, restrictApi, ResultController.removeFromVolume);

// Result vizualization data
projectsApi.get(`/result/:idResult/data`, restrictApi, ResultController.getResultData);