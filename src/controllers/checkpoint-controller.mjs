// @ts-check

import Checkpoint from "../models/checkpoint.mjs";
import { ApiError } from "../tools/error-handler.mjs";
import { prepareDataForDownload } from "../tools/file-handler.mjs";
import path from "path";
import Utils from "../tools/utils.mjs";
import fileUpload from "express-fileupload";

/**
 * @typedef { import("express").Request } Request
 * @typedef { import("express").Response } Response
 */

export default class CheckpointController {
    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async getCheckpoint(req, res) {
        const checkpoint = await Checkpoint.getById(
            Number(req.params.idCheckpoint)
        );
        res.json(checkpoint);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async getCheckpointsFromModel(req, res) {
        const checkpoints = await Checkpoint.getFromModel(
            Number(req.params.idModel)
        );
        res.json(checkpoints);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async uploadCheckpoints(req, res) {
        if (!req.files || !req.files.files) {
            throw new ApiError(400, "No files uploaded.");
        }

        const checkpoints = await Checkpoint.createFromFiles(
            Number(req.session.user.id),
            Number(req.params.idModel),
            Array.isArray(req.files.files) ? req.files.files : [req.files.files]
        );

        res.status(201).json(checkpoints);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async downloadCheckpoint(req, res) {
        const checkpoint = await Checkpoint.getById(
            Number(req.params.idCheckpoint)
        );
        let data = prepareDataForDownload(
            [checkpoint.filePath],
            path.basename(checkpoint.filePath)
        );
        res.set("Content-Type", "application/zip");
        res.set("Content-Disposition", "attachment; filename=" + data.name);
        res.send(data.zipBuffer);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async removeFromModel(req, res) {
        const modelId = Number(req.params.idModel);

        const checkpoint = await Checkpoint.removeFromModel(
            Number(req.params.idCheckpoint),
            modelId
        );

        res.sendStatus(204);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async checkpointToText(req, res) {
        const checkpoint = await Checkpoint.getById(
            Number(req.params.idCheckpoint)
        );

        if (!checkpoint.filePath) {
            throw new ApiError(400, "Checkpoint is missing a file.");
        }

        const checkpointTxt = await Utils.ckptToText(checkpoint.filePath);

        res.send(checkpointTxt);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async checkpointFileToText(req, res) {
        if (!req.files || !req.files.checkpoint) {
            throw new ApiError(400, "No files uploaded.");
        }

        if (Array.isArray(req.files.checkpoint)) {
            throw new ApiError(
                400,
                "Only one checkpoint file can be parsed at a time."
            );
        }

        /** @type {fileUpload.UploadedFile} */
        const checkpointFile = req.files.checkpoint;

        const checkpointTxt = await Utils.ckptToText(
            checkpointFile.tempFilePath
        );

        res.send(checkpointTxt);
    }
}
