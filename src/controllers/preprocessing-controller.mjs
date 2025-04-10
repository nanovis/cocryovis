import RawVolumeData from "../models/raw-volume-data.mjs";
import { VolumeDataFactory } from "../models/volume-data-factory.mjs";
import path from "path";
import { ApiError } from "../tools/error-handler.mjs";
import fileSystem from "fs";
import Utils from "../tools/utils.mjs";
import fsPromises from "node:fs/promises";
import MotionCorHandler from "../tools/motioncor-handler.mjs";
import GCTFFindHandler from "../tools/gctffind-handler.mjs";
import archiver from "archiver";
import fs from "fs";

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
        if (!req.files || !req.files.tiltSeries) {
            throw new ApiError(400, "No files uploaded.");
        }

        if (Array.isArray(req.files.tiltSeries)) {
            throw new ApiError(
                400,
                "Only one tilt series can be added to volume."
            );
        }

        const data = JSON.parse(req.body.data);

        await gpuTaskHandler.queueTiltSeriesReconstruction(
            req.files.tiltSeries,
            data.options,
            Number(data.volumeId),
            req.session.user.id
        );

        res.sendStatus(204);
    }
}
