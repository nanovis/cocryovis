// @ts-check

import GPUTaskHandler from "../tools/gpu-task-handler.mjs";
import Utils from "../tools/utils.mjs";

export default class NanoOetziController {
    /**
     * @param {GPUTaskHandler} gpuTaskHandler
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async getNanoOetziTaskQueue(gpuTaskHandler, req, res) {
        const taskQueue = gpuTaskHandler.getTaskQueue();

        res.json(taskQueue);
    }

    /**
     * @param {GPUTaskHandler} gpuTaskHandler
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async getNanoOetziUserTaskHistory(gpuTaskHandler, req, res) {
        const taskHistory = gpuTaskHandler.taskHistory.getUserTaskHistory(
            req.session.user.id
        );

        res.json(taskHistory);
    }

    /**
     * @param {GPUTaskHandler} gpuTaskHandler
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async queueInference(gpuTaskHandler, req, res) {
        const checkpointId = Number(req.body.checkpointId);
        const volumeId = Number(req.body.volumeId);

        await gpuTaskHandler.queueInference(
            checkpointId,
            volumeId,
            Number(req.session.user.id)
        );

        res.sendStatus(204);
    }

    /**
     * @param {GPUTaskHandler} gpuTaskHandler
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async queueTraining(gpuTaskHandler, req, res) {
        const trainingVolumesIds = Utils.parseStringArray(
            req.body.trainingVolumes
        );
        const validationVolumesIds = Utils.parseStringArray(
            req.body.validationVolumes
        );
        const testingVolumesIds = Utils.parseStringArray(
            req.body.testingVolumes
        );

        await gpuTaskHandler.queueTraining(
            Number(req.body.modelId),
            Number(req.session.user.id),
            trainingVolumesIds,
            validationVolumesIds,
            testingVolumesIds
        );

        res.sendStatus(204);
    }
}
