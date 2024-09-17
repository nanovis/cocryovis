// @ts-check

import Volume from "../models/volume.mjs";
import User from "../models/user.mjs";
import NanoOetziHandler, {
    InferenceTaskProperties,
    TrainingTaskProperties,
} from "../tools/nano-oetzi-handler.mjs";
import Model from "../models/model.mjs";
import Utils from "../tools/utils.mjs";
import Checkpoint from "../models/checkpoint.mjs";
import path from "path";

export default class NanoOetziController {
    /**
     * @param {NanoOetziHandler} nanoOetzi
     */
    static async getNanoOetziTaskQueue(nanoOetzi, req, res) {
        try {
            const taskQueueIdentifiers = nanoOetzi.queuedIdentifiers;

            const users = await User.getByIds(
                taskQueueIdentifiers.map((i) => i.userId)
            );
            const volumes = await Volume.getByIds(
                taskQueueIdentifiers
                    .filter((i) => i instanceof InferenceTaskProperties)
                    .map((i) => i.volumeId)
            );
            const checkpoints = await Checkpoint.getByIds(
                taskQueueIdentifiers
                    .filter((i) => i instanceof InferenceTaskProperties)
                    .map((i) => i.checkpointId)
            );
            const models = await Model.getByIds(
                taskQueueIdentifiers
                    .filter((i) => i instanceof TrainingTaskProperties)
                    .map((i) => i.modelId)
            );

            let inferenceIndex = 0;
            let trainingIndex = 0;
            const result = taskQueueIdentifiers.map(function (t, i) {
                const user = users[i];
                let entry = {
                    userId: user.id,
                    username: user.username,
                    type: t.type,
                };
                if (t instanceof InferenceTaskProperties) {
                    const checkpoint = checkpoints[inferenceIndex];
                    const volume = volumes[inferenceIndex];

                    entry.volumeId = volume.id;
                    entry.volumeName = volume.name;
                    entry.checkpointId = checkpoint.id;
                    entry.checkpointName = path.basename(checkpoint.filePath);
                    inferenceIndex++;
                }
                if (t instanceof TrainingTaskProperties) {
                    entry.modelId = models[trainingIndex].id;
                    entry.modelName = models[trainingIndex].name;
                    trainingIndex++;
                }
                return entry;
            });

            res.setHeader("Content-Type", "application/json");
            res.json(result);
        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }
    }

    /**
     * @param {NanoOetziHandler} nanoOetzi
     */
    static async getNanoOetziUserTaskHistory(nanoOetzi, req, res) {
        try {
            const userTaskHistory = nanoOetzi.taskHistory.filter(
                (t) => t.taskProperties.userId === req.session.user.id
            );
            const taskProperties = nanoOetzi.taskHistory.map(
                (t) => t.taskProperties
            );

            const volumes = await Volume.getByIds(
                taskProperties
                    .filter((t) => t instanceof InferenceTaskProperties)
                    .map((t) => t.volumeId)
            );
            const checkpoints = await Checkpoint.getByIds(
                taskProperties
                    .filter((t) => t instanceof InferenceTaskProperties)
                    .map((t) => t.checkpointId)
            );
            const models = await Model.getByIds(
                taskProperties
                    .filter((t) => t instanceof TrainingTaskProperties)
                    .map((t) => t.modelId)
            );

            let inferenceIndex = 0;
            let trainingIndex = 0;
            const result = userTaskHistory.map(function (t, i) {
                let entry = {
                    type: t.taskProperties.type,
                    taskStatus: t.taskStatus,
                    logFile: t.logFile.fileName,
                };
                if (t.taskProperties instanceof InferenceTaskProperties) {
                    const checkpoint = checkpoints[inferenceIndex];
                    const volume = volumes[inferenceIndex];

                    entry.volumeId = volume.id;
                    entry.volumeName = volume.name;
                    entry.checkpointId = checkpoint.id;
                    entry.checkpointName = path.basename(checkpoint.filePath);
                    inferenceIndex++;
                }
                if (t.taskProperties instanceof TrainingTaskProperties) {
                    entry.modelId = models[trainingIndex].id;
                    entry.modelName = models[trainingIndex].name;
                    trainingIndex++;
                }
                return entry;
            });

            res.setHeader("Content-Type", "application/json");
            res.json(result);
        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }
    }

    /**
     * @param {NanoOetziHandler} nanoOetzi
     */
    static async runInference(nanoOetzi, req, res) {
        try {
            const checkpointId = Number(req.body.checkpointId);
            const volumeId = Number(req.body.volumeId);

            await nanoOetzi.queueInference(
                checkpointId,
                volumeId,
                Number(req.session.user.id)
            );

            res.redirect(
                `/api/actions/projects/details/` + req.params.idProject
            );
        } catch (err) {
            console.log(err);
            res.status(500).send(err);
        }
    }

    /**
     * @param {NanoOetziHandler} nanoOetzi
     */
    static async runTraining(nanoOetzi, req, res) {
        try {
            const trainingVolumesIds = Utils.parseStringArray(
                req.body.trainingVolumes
            );
            const validationVolumesIds = Utils.parseStringArray(
                req.body.validationVolumes
            );
            const testingVolumesIds = Utils.parseStringArray(
                req.body.testingVolumes
            );

            await nanoOetzi.queueTraining(
                Number(req.body.modelId),
                Number(req.session.user.id),
                trainingVolumesIds,
                validationVolumesIds,
                testingVolumesIds
            );

            res.redirect(
                `/api/actions/projects/details/` + req.params.idProject
            );
        } catch (err) {
            console.error("Error in creating model:", err);
            res.status(500).send(err);
        }
    }
}
