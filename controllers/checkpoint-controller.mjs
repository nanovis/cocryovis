// @ts-check

import Checkpoint from "../models/checkpoint.mjs";
import { prepareDataForDownload } from "../tools/file-handler.mjs";
import path from "path";

export default class CheckpointController {
    static async uploadCheckpoints(req, res) {
        try {
            if (!req.files || !req.files.files) {
                res.send({
                    status: false,
                    message: "No file uploaded",
                });
            } else {
                let files = req.files.files;
                if (!Array.isArray(req.files.files)) {
                    files = [req.files.files];
                }
                await Checkpoint.createFromFiles(
                    Number(req.session.user.id),
                    Number(req.params.idModel),
                    files
                );
                res.redirect(
                    `/api/actions/projects/details/` + req.params.idProject
                );
            }
        } catch (err) {
            res.status(500).send(err);
        }
    }

    static async downloadCheckpoint(req, res) {
        try {
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
        } catch (err) {
            res.status(500).send(err);
        }
    }

    static async deleteCheckpoint(req, res) {
        try {
            await Checkpoint.del(Number(req.params.idCheckpoint));
            res.redirect(
                `/api/actions/projects/details/` + req.params.idProject
            );
        } catch (err) {
            res.status(500).send(err);
        }
    }

    static async removeFromModel(req, res) {
        try {
            await Checkpoint.removeFromModel(
                Number(req.params.idCheckpoint),
                Number(req.params.idModel)
            );
            res.redirect(
                `/api/actions/projects/details/` + req.params.idProject
            );
        } catch (err) {
            res.status(500).send(err);
        }
    }
}
