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
        const taskQueueIdentifiers = nanoOetzi.queuedIdentifiers;

        const users = await User.getByIds(
            taskQueueIdentifiers.map((i) => i.userId)
        );
        const usersMap = Utils.arrayToMap(users, "id");

        const volumes = await Volume.getByIds(
            taskQueueIdentifiers
                .filter((i) => i instanceof InferenceTaskProperties)
                .map((i) => i.volumeId)
        );
        const volumeMap = Utils.arrayToMap(volumes, "id");

        const checkpoints = await Checkpoint.getByIds(
            taskQueueIdentifiers
                .filter((i) => i instanceof InferenceTaskProperties)
                .map((i) => i.checkpointId)
        );
        const checkpointMap = Utils.arrayToMap(checkpoints, "id");

        const models = await Model.getByIds(
            taskQueueIdentifiers
                .filter((i) => i instanceof TrainingTaskProperties)
                .map((i) => i.modelId)
        );
        const modelMap = Utils.arrayToMap(models, "id");

        let inferenceIndex = 0;
        let trainingIndex = 0;
        const result = taskQueueIdentifiers.map(function (t) {
            const user = usersMap.get(t.userId);
            let entry = {
                userId: user.id,
                username: user.username,
                type: t.type,
            };
            if (t instanceof InferenceTaskProperties) {
                const checkpoint = checkpointMap.get(t.checkpointId);
                const volume = volumeMap.get(t.volumeId);

                entry.volumeId = volume.id;
                entry.volumeName = volume.name;
                entry.checkpointId = checkpoint.id;
                entry.checkpointName = path.basename(checkpoint.filePath);
                inferenceIndex++;
            }
            if (t instanceof TrainingTaskProperties) {
                const model = modelMap.get(t.modelId);

                entry.modelId = model.id;
                entry.modelName = model.name;
                trainingIndex++;
            }
            return entry;
        });

        return res.json(result);
    }

    /**
     * @param {NanoOetziHandler} nanoOetzi
     */
    static async getNanoOetziUserTaskHistory(nanoOetzi, req, res) {
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
        const volumeMap = Utils.arrayToMap(volumes, "id");

        const checkpoints = await Checkpoint.getByIds(
            taskProperties
                .filter((t) => t instanceof InferenceTaskProperties)
                .map((t) => t.checkpointId)
        );
        const checkpointMap = Utils.arrayToMap(checkpoints, "id");

        const models = await Model.getByIds(
            taskProperties
                .filter((t) => t instanceof TrainingTaskProperties)
                .map((t) => t.modelId)
        );
        const modelMap = Utils.arrayToMap(models, "id");

        let inferenceIndex = 0;
        let trainingIndex = 0;
        const result = userTaskHistory.map(function (t) {
            let entry = {
                type: t.taskProperties.type,
                taskStatus: t.taskStatus,
                logFile: t.logFile.fileName,
            };
            if (t.taskProperties instanceof InferenceTaskProperties) {
                const checkpoint = checkpointMap.get(
                    t.taskProperties.checkpointId
                );
                const volume = volumeMap.get(t.taskProperties.volumeId);

                entry.volumeId = volume.id;
                entry.volumeName = volume.name;
                entry.checkpointId = checkpoint.id;
                entry.checkpointName = path.basename(checkpoint.filePath);
                inferenceIndex++;
            }
            if (t.taskProperties instanceof TrainingTaskProperties) {
                const model = modelMap.get(t.taskProperties.modelId);

                entry.modelId = model.id;
                entry.modelName = model.name;
                trainingIndex++;
            }
            return entry;
        });

        return res.json(result.reverse());
    }

    /**
     * @param {NanoOetziHandler} nanoOetzi
     */
    static async queueInference(nanoOetzi, req, res) {
        const checkpointId = Number(req.body.checkpointId);
        const volumeId = Number(req.body.volumeId);

        await nanoOetzi.queueInference(
            checkpointId,
            volumeId,
            Number(req.session.user.id)
        );

        return res.sendStatus(204);
    }

    /**
     * @param {NanoOetziHandler} nanoOetzi
     */
    static async queueTraining(nanoOetzi, req, res) {
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

        return res.sendStatus(204);
    }
}
