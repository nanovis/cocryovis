import express from 'express';
import DatabaseManager from "../../tools/lowdb-manager.mjs";
import { spawn } from 'child_process';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import { IlastikHandler } from '../../tools/ilastik-handler.mjs';
import { NanoOetziHandler } from '../../tools/nano-oetzi-handler.mjs';
import { restrict } from '../../middleware/restrict.mjs';
import { ControllerFactory } from "../../controllers/controller-factory.mjs";
import {publicDataPath, publicPath} from "../../tools/utils.mjs";
import appConfig from "../../tools/config.mjs";

// Config
const config = appConfig;
const ilastikHandler = new IlastikHandler(config.ilastik);
const nanoOetzi = new NanoOetziHandler(config.nanoOetzi);

// DB connection
const db = DatabaseManager.db;

const projectController = ControllerFactory.getProjectController(config.db.type);
const volumeController = ControllerFactory.getVolumeController(config.db.type);
const volumeDataController = ControllerFactory.getVolumeDataController(config.db.type);
const modelController = ControllerFactory.getModelController(config.db.type);
const checkpointController = ControllerFactory.getCheckpointController(config.db.type);
const resultController = ControllerFactory.getResultController(config.db.type);

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
            const results = resultController.getResultsVolumesFromVolume(volume.id);
            project.volumes.push({"details": volume, "rawData": rawData,
                "sparseLabeledVolumes": sparseLabeledVolumes, "pseudoLabeledVolumes": pseudoLabeledVolumes, "results": results});
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
actions.post(`/${projectsActionsPath}/:idProject/volumeData/:idVolumeData/upload-files`, restrict, async (req, res) => {
    try {
        if (!req.files || !req.files.files) {
            console.log(req)
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
        console.log(err)
    }
});

// Add Mrc File to Volume Data
actions.post(`/${projectsActionsPath}/:idProject/volumeData/:idVolumeData/upload-mrc-file`, restrict, async (req, res) => {
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

/////// RESULTS
// Remove Result
actions.get(`/${projectsActionsPath}/:idProject/result/:idResult/delete`, restrict, async (req, res) => {
    console.log(`Deleting Result ${req.params.idResult}`);
    try {
        await resultController.delete(req.params.idResult);
        res.redirect(`/api/actions/${projectsActionsPath}/details/${req.params.idProject}`);
    } catch (err) {
        console.error("Error in creating model:", err);
        res.status(500).send(err);
    }
});

// Download Result
actions.get(`/${projectsActionsPath}/:idProject/result/:idResult/download`, restrict, async (req, res) => {
    try {
        const result = resultController.getById(req.params.idResult);
        let data = result.prepareDataForDownload();
        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', 'attachment; filename=' + data.name);
        res.send(data.zipBuffer);
    } catch (err) {
        res.status(500).send(err);
    }
});

// Download Result File
actions.get(`/${projectsActionsPath}/:idProject/result/:idResult/download/:fileIndex`, restrict, async (req, res) => {
    try {
        const result = resultController.getById(req.params.idResult);
        const file = result.getFile(Number(req.params.fileIndex));
        let data = file.prepareDataForDownload();
        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', 'attachment; filename=' + data.name);
        res.send(data.zipBuffer);
    } catch (err) {
        res.status(500).send(err);
    }
});

// Inference test
actions.get(`/inference-test`, async (req, res) => {
    try {
        await modelController.runInference(1, 1, 1, 1, nanoOetzi);
    } catch (err) {
        console.log(err)
        res.status(500).send(err);
    }
});

// Ilastik Inference test
actions.get(`/ilastik-test`, async (req, res) => {
    try {
        await volumeController.createPseudoLabels(1, ilastikHandler);
    } catch (err) {
        console.log(err)
        res.status(500).send(err);
    }
});