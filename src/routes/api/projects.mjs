// @ts-check

import express, { Router } from 'express';
import IlastikHandler from '../../tools/ilastik-handler.mjs';
import GPUTaskHandler from '../../tools/gpu-task-handler.mjs';
import { restrictApi, restrictReadCheckpointAccess, restrictReadModelAccess, restrictReadProjectAccess, restrictReadResultAccess, restrictReadVolumeAccess, restrictReadVolumeDataAccess } from '../../middleware/restrict.mjs';
import appConfig from "../../tools/config.mjs";
import ProjectController from '../../controllers/project-controller.mjs';
import VolumeController from '../../controllers/volume-controller.mjs';
import VolumeDataController from '../../controllers/volume-data-controller.mjs';
import { VolumeDataType } from '../../models/volume-data-factory.mjs';
import ModelController from '../../controllers/model-controller.mjs';
import CheckpointController from '../../controllers/checkpoint-controller.mjs';
import ResultController from '../../controllers/result-controller.mjs';
import IlastikController from '../../controllers/ilastik-controller.mjs';
import NanoOetziController from '../../controllers/nano-oetzi-controller.mjs';
import UserController from '../../controllers/user-controller.mjs';
import toAsyncRouter from 'async-express-decorator'
import PreProcessingController from '../../controllers/preprocessing-controller.mjs';
import DemoController from '../../controllers/demo-controller.mjs';

// Config
const config = appConfig;
const ilastikHandler = new IlastikHandler(config);
const gpuTaskHandler = new GPUTaskHandler(config);

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

projectsApi.get('/users', restrictApi, UserController.getAllUsers);

projectsApi.get(`/status`, restrictApi, UserController.getStatus);

///////////////////////
/////// PROJECTS
///////////////////////

// Get Project List
projectsApi.get(`/projects`, restrictApi, ProjectController.getAllUserProjects);
projectsApi.get(`/projects-deep`, restrictApi, ProjectController.getAllUserProjectsDeep);

// Create New Project
projectsApi.post(`/projects`, restrictApi, ProjectController.createProject);

// Get Project
projectsApi.get(`/project/:idProject`, restrictReadProjectAccess, ProjectController.getProject);
// Get Project
projectsApi.get(`/project/:idProject/deep`, restrictReadProjectAccess, ProjectController.getProjectDeep);

// Get Project Access Info
projectsApi.get(`/project/:idProject/access`, restrictReadProjectAccess, ProjectController.getAccessInfo);

// Set Project Access Info
projectsApi.post(`/project/:idProject/access`, restrictApi, ProjectController.setAccess);

// Deep Clone Project
projectsApi.post(`/project/:idProject/deep-clone`, restrictApi, ProjectController.deepCloneProject);

// Delete Project
projectsApi.delete(`/project/:idProject`, restrictApi, ProjectController.deleteProject);

/////// ILASTIK

// Run Ilastik inference
projectsApi.post(`/volume/:idVolume/queue-pseudo-label-generation`, restrictApi,
    async (req, res) => IlastikController.queuePseudoLabelsGeneration(ilastikHandler, req, res));

/////// NANO OETZI

// Inference
projectsApi.post(`/queue-inference`, restrictApi,
    async (req, res) => NanoOetziController.queueInference(gpuTaskHandler, req, res));

// Run training
projectsApi.post(`/queue-training`, restrictApi, 
    async (req, res) => NanoOetziController.queueTraining(gpuTaskHandler, req, res));


/////// CRYO-ET

projectsApi.post(`/tilt-series-reconstruction`, restrictApi,
    async (req, res) => PreProcessingController.queueTiltSeriesReconstruction(gpuTaskHandler, req, res));


/////// VOLUMES

// Get Volumes from project
projectsApi.get(`/project/:idProject/volumes`, restrictReadProjectAccess, VolumeController.getVolumesFromProject);
projectsApi.get(`/project/:idProject/volumes/deep`, restrictReadProjectAccess, VolumeController.getVolumesFromProjectDeep);

// Create New Volume
projectsApi.post(`/project/:idProject/volumes`, restrictApi, VolumeController.createVolume);

// Clone Volume
projectsApi.post(`/project/:idProject/volume/:idVolume/clone`, restrictApi, VolumeController.cloneVolume);

// Get Volume
projectsApi.get(`/volume/:idVolume`, restrictReadVolumeAccess, VolumeController.getVolume);

// Remove Volume
projectsApi.delete(`/project/:idProject/volume/:idVolume`, restrictApi, VolumeController.removeFromProject);

// Process Manual Labels
projectsApi.put(`/volume/:idVolume/add-annotations`, restrictApi, 
    async (req, res) => VolumeController.addAnnotations(req, res));

/////// VOLUME DATA

const readVolumeDataPrefix = "/volumeData/:type/:idVolumeData";

// Get Raw Data
projectsApi.get(`${readVolumeDataPrefix}`, restrictReadVolumeDataAccess, 
    async (req, res) => VolumeDataController.getById(VolumeDataType.mapName(req.params.type), req, res));

// Get Raw Data Files
projectsApi.get(`${readVolumeDataPrefix}/data`, restrictReadVolumeDataAccess,
    async (req, res) => VolumeDataController.getData(VolumeDataType.mapName(req.params.type), req, res));

// Update Raw Data
projectsApi.put(`/volumeData/:type/:idVolumeData`, restrictApi, 
    async (req, res) => VolumeDataController.update(VolumeDataType.mapName(req.params.type), req, res));

// Visualize
projectsApi.get(`${readVolumeDataPrefix}/visualization-data`, restrictReadVolumeDataAccess, 
    async (req, res) => VolumeDataController.getVolumeVisualizationFiles(VolumeDataType.mapName(req.params.type), req, res));

// Create from Files
projectsApi.post(`/volume/:idVolume/volumeData/:type/from-files`, restrictApi, 
    async (req, res) => (VolumeDataController.createFromFiles(VolumeDataType.mapName(req.params.type), req, res)));

// Create from Mrc File
projectsApi.post(`/volume/:idVolume/volumeData/:type/from-mrc-file`, restrictApi,
    async (req, res) => (VolumeDataController.createFromMrcFile(VolumeDataType.mapName(req.params.type), req, res)));

// Create from URL
projectsApi.post(`/volume/:idVolume/volumeData/:type/from-url`, restrictApi,
    async (req, res) => (VolumeDataController.createFromUrl(req, res)));

// Update Annotations
projectsApi.put(`/volume/:idVolume/volumeData/:type/:idVolumeData/update-annotations`, restrictApi,
    async (req, res) => (VolumeDataController.updateAnnotations(VolumeDataType.mapName(req.params.type), req, res)));

    
// Download Raw Volume Data
projectsApi.get(`${readVolumeDataPrefix}/download-full`, restrictReadVolumeDataAccess, 
    async (req, res) => VolumeDataController.downloadFullVolumeData(VolumeDataType.mapName(req.params.type), req, res));

projectsApi.get(`${readVolumeDataPrefix}/download-raw-file`, restrictReadVolumeDataAccess,
    async (req, res) => VolumeDataController.downloadRawFile(VolumeDataType.mapName(req.params.type), req, res));

projectsApi.get(`${readVolumeDataPrefix}/download-settings-file`, restrictReadVolumeDataAccess, 
    async (req, res) => VolumeDataController.downloadSettingsFile(VolumeDataType.mapName(req.params.type), req, res));

projectsApi.get(`${readVolumeDataPrefix}/download-mrc-file`, restrictReadVolumeDataAccess, 
    async (req, res) => VolumeDataController.downloadMrcFile(VolumeDataType.mapName(req.params.type), req, res));

// Delete Volume Data
projectsApi.delete(`/volume/:idVolume/volumeData/:type/:idVolumeData`, restrictApi, 
    async (req, res) => VolumeDataController.removeFromVolume(VolumeDataType.mapName(req.params.type), req, res));
  
// CryoET Tomogram Metadata
projectsApi.get(`/cryoet/:idTomogram/`, 
    async (req, res) => VolumeDataController.getTomographyMetadataFromCryoETId(req, res));
    

/////// MODELS

// Get Models from Project
projectsApi.get(`/project/:idProject/models`, restrictApi, ModelController.getModelsFromProject);

// Create New Model
projectsApi.post(`/project/:idProject/models`, restrictApi, ModelController.createModel);

// Clone Model
projectsApi.post(`/project/:idProject/model/:idModel/clone`, restrictApi, ModelController.cloneModel);

// Get Model
projectsApi.get(`/model/:idModel`, restrictReadModelAccess, ModelController.getModel);

// Remove Model
projectsApi.delete(`/project/:idProject/model/:idModel`, restrictApi, ModelController.removeFromProject);

/////// CHECKPOINTS

// Get checkpoint info
projectsApi.get(`/checkpoint/:idCheckpoint`, restrictReadCheckpointAccess, CheckpointController.getCheckpoint);

// Delete checkpoint
projectsApi.delete(`/model/:idModel/checkpoint/:idCheckpoint`, restrictApi, CheckpointController.removeFromModel);

// Get checkpoints from model
projectsApi.get(`/model/:idModel/checkpoints`, restrictReadModelAccess, CheckpointController.getCheckpointsFromModel);

// Upload new checkpoints
projectsApi.post(`/model/:idModel/checkpoints`, restrictApi, CheckpointController.uploadCheckpoints);

// Download checkpoint
projectsApi.get(`/checkpoint/:idCheckpoint/download`, restrictReadCheckpointAccess, CheckpointController.downloadCheckpoint);

// Download checkpoint
projectsApi.get(`/checkpoint/:idCheckpoint/as-text`, restrictReadCheckpointAccess, CheckpointController.checkpointToText);

// Convert checkpoint to text
projectsApi.post(`/checkpoint/to-text`, CheckpointController.checkpointFileToText);

/////// RESULTS
// Get Result
projectsApi.get(`/result/:idResult`, restrictReadResultAccess, ResultController.getById);

// Get Result Details
projectsApi.get(`/result/:idResult/details`, restrictReadResultAccess, ResultController.getDetails);

// Get Results From Volume
projectsApi.get(`/volume/:idVolume/results`, restrictReadVolumeAccess, ResultController.getFromVolume);

// Create Result from Fules
projectsApi.post(`/volume/:idVolume/results`, restrictApi, ResultController.createFromFiles);

// Remove Result
projectsApi.delete(`/volume/:idVolume/result/:idResult`, restrictApi, ResultController.removeFromVolume);

// Result vizualization data
projectsApi.get(`/result/:idResult/data`, restrictReadResultAccess, ResultController.getResultData);


/////// DEMO
// Get Result
projectsApi.get(`/demo`, DemoController.getDemo);