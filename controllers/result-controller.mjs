// @ts-check

import Result from "../models/result.mjs";
import { prepareDataForDownload } from "../tools/file-handler.mjs";

export default class ResultController {
    static async downloadResult(req, res) {
        try {
            const result = await Result.getById(Number(req.params.idResult));

            if (!result.files) {
                throw new Error("Result has no files.");
            }

            const filePaths = JSON.parse(result.files);
            let data = prepareDataForDownload(filePaths, `Result_${result.id}`);
            res.set("Content-Type", "application/zip");
            res.set("Content-Disposition", "attachment; filename=" + data.name);
            res.send(data.zipBuffer);
        } catch (err) {
            res.status(500).send(err);
        }
    }

    static async downloadResultFile(req, res) {
        try {
            const result = await Result.getById(Number(req.params.idResult));

            if (!result.files) {
                throw new Error("Result has no files.");
            }

            const filePaths = JSON.parse(result.files);
            const fileIndex = Number(req.params.fileIndex);

            if (fileIndex >= filePaths.length) {
                throw new Error("Requested file does not exist.");
            }

            let data = prepareDataForDownload(
                [filePaths[fileIndex]],
                `Result_${result.id}`
            );
            res.set("Content-Type", "application/zip");
            res.set("Content-Disposition", "attachment; filename=" + data.name);
            res.send(data.zipBuffer);
        } catch (err) {
            res.status(500).send(err);
        }
    }

    static async deleteResult(req, res) {
        try {
            await Result.del(Number(req.params.idResult));
            res.redirect(
                `/api/actions/projects/details/` + req.params.idProject
            );
        } catch (err) {
            res.status(500).send(err);
        }
    }

    static async removeFromVolume(req, res) {
        try {
            await Result.removeFromVolume(
                Number(req.params.idResult),
                Number(req.params.idVolume)
            );
            res.redirect(
                `/api/actions/projects/details/` + req.params.idProject
            );
        } catch (err) {
            res.status(500).send(err);
        }
    }
}
