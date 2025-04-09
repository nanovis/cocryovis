// @ts-check

import { ApiError } from "../tools/error-handler.mjs";
import GPUTaskHandler from "../tools/gpu-task-handler.mjs";
import Utils from "../tools/utils.mjs";

/**
 * @typedef { import("express").Request } Request
 * @typedef { import("express").Response } Response
 */

export default class NanoOetziController {
    /**
     * @param {GPUTaskHandler} gpuTaskHandler
     * @param {Request} req
     * @param {Response} res
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
     * @param {Request} req
     * @param {Response} res
     */
    static async queueTraining(gpuTaskHandler, req, res) {
        const trainingVolumesIds = Utils.parseStringArray(
            req.body.trainingVolumes
        );
        delete req.body.trainingVolumes;
        const validationVolumesIds = Utils.parseStringArray(
            req.body.validationVolumes
        );
        delete req.body.validationVolumes;
        const testingVolumesIds = Utils.parseStringArray(
            req.body.testingVolumes
        );
        delete req.body.testingVolumes;

        await gpuTaskHandler.queueTraining(
            Number(req.body.modelId),
            Number(req.session.user.id),
            trainingVolumesIds,
            validationVolumesIds,
            testingVolumesIds,
            req.body
        );

        res.sendStatus(204);
    }
}
