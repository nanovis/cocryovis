// @ts-check

import { inferenceIds, trainingReq } from "#schemas/nano-oetzi-path-schema.mjs";
import validateSchema from "../tools/validate-schema.mjs";
import GPUTaskHandler from "../tools/gpu-task-handler.mjs";

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
        const { body } = validateSchema(req, { bodySchema: inferenceIds });

        const checkpointId = body.checkpointId;
        const volumeId = body.volumeId;

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
        const { body } = validateSchema(req, { bodySchema: trainingReq });

        await gpuTaskHandler.queueTraining(
            body.modelId,
            Number(req.session.user.id),
            body.trainingVolumesIds,
            body.validationVolumesIds,
            body.testingVolumesIds,
            body
        );

        res.sendStatus(204);
    }
}
