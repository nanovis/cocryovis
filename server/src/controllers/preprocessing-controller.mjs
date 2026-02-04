// @ts-check

import { ApiError } from "../tools/error-handler.mjs";
import GPUTaskHandler from "../tools/gpu-task-handler.mjs";

/**
 * @typedef { import("express").Request } Request
 * @typedef { import("express").Response } Response
 */



export default class PreProcessingController {
    /**
     * @param {GPUTaskHandler} gpuTaskHandler
     * @param {Request} req
     * @param {Response} res
     */
    static async queueTiltSeriesReconstruction(gpuTaskHandler, req, res) {
        // TODO make validateSchema work with multipart/form-data
        // const { body } = validateSchema(req, {
        //     bodySchema: tiltSeriesValidation,
        // });

        if (!req.files || !req.files.tiltSeries) {
            throw new ApiError(400, "No files uploaded.");
        }

        if (Array.isArray(req.files.tiltSeries)) {
            throw new ApiError(
                400,
                "Only one tilt series can be added to volume."
            );
        }
        // Check if zod parses json
        const data = JSON.parse(req.body.data);

        await gpuTaskHandler.queueTiltSeriesReconstruction(
            req.files.tiltSeries,
            data.options,
            data.volumeId,
            req.session.user.id
        );

        res.sendStatus(204);
    }
}
