// @ts-check

import Checkpoint from "../models/checkpoint.mjs";
import { ApiError } from "../tools/error-handler.mjs";
import { prepareDataForDownload } from "../tools/file-handler.mjs";
import path from "path";

export default class CheckpointController {
    static async uploadCheckpoints(req, res) {
        if (!req.files || !req.files.files) {
            throw new ApiError(400, "No files uploaded.");
        }

        let files = req.files.files;
        if (!Array.isArray(req.files.files)) {
            files = [req.files.files];
        }
        const checkpoints = await Checkpoint.createFromFiles(
            Number(req.session.user.id),
            Number(req.params.idModel),
            files
        );
        return res.status(201).json(checkpoints);
    }

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

    static async deleteCheckpoint(req, res) {
        await Checkpoint.del(Number(req.params.idCheckpoint));
        return res.sendStatus(204);
    }

    static async removeFromModel(req, res) {
        await Checkpoint.removeFromModel(
            Number(req.params.idCheckpoint),
            Number(req.params.idModel)
        );
        return res.sendStatus(204);
    }
}
