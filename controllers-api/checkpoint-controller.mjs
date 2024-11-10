// @ts-check

import Checkpoint from "../models/checkpoint.mjs";
import { ApiError } from "../tools/error-handler.mjs";
import { prepareDataForDownload } from "../tools/file-handler.mjs";
import path from "path";
import Utils from "../tools/utils.mjs";
import fileUpload from "express-fileupload";

export default class CheckpointController {
    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async getCheckpoint(req, res) {
        const checkpoint = await Checkpoint.getById(
            Number(req.params.idCheckpoint)
        );
        return res.json(checkpoint);
    }

    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async getCheckpointsFromModel(req, res) {
        const checkpoints = await Checkpoint.getFromModel(
            Number(req.params.idModel)
        );
        return res.json(checkpoints);
    }

    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
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
        
        return res.status(201).json(checkpoints);
    }

    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
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
        return res.send(data.zipBuffer);
    }

    // static async deleteCheckpoint(req, res) {
    //     const checkpoint = await Checkpoint.del(
    //         Number(req.params.idCheckpoint)
    //     );
    //     res.sendStatus(204);
    // }

    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async removeFromModel(req, res) {
        const modelId = Number(req.params.idModel);

        const checkpoint = await Checkpoint.removeFromModel(
            Number(req.params.idCheckpoint),
            modelId
        );

        return res.sendStatus(204);
    }

    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async checkpointToText(req, res) {
        const checkpoint = await Checkpoint.getById(
            Number(req.params.idCheckpoint)
        );

        if (!checkpoint.filePath) {
            throw new ApiError(400, "Checkpoint is missing a file.");
        }

        const checkpointTxt = await Utils.ckptToText(checkpoint.filePath);

        return res.send(checkpointTxt);
    }

    /**
     * @param {UnauthenticatedRequest} req
     * @param {import("express").Response} res
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

        return res.send(checkpointTxt);
    }
}
