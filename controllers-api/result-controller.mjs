// @ts-check

import Result from "../models/result.mjs";
import { ApiError } from "../tools/error-handler.mjs";
import { prepareDataForDownload } from "../tools/file-handler.mjs";

export default class ResultController {
    static async getById(req, res) {
        const result = await Result.getById(Number(req.params.idResult));

        return res.json(result);
    }

    static async getDetails(req, res) {
        const result = await Result.getByIdDeep(Number(req.params.idResult), {
            checkpoint: true,
        });

        return res.json(result);
    }

    static async downloadResult(req, res) {
        const result = await Result.getById(Number(req.params.idResult));

        if (!result.files) {
            throw new ApiError(400, "Result has no files.");
        }

        const filePaths = JSON.parse(result.files);
        const data = prepareDataForDownload(filePaths, `Result_${result.id}`);
        res.set("Content-Type", "application/zip");
        res.set("Content-Disposition", "attachment; filename=" + data.name);
        return res.send(data.zipBuffer);
    }

    static async downloadResultFile(req, res) {
        const result = await Result.getById(Number(req.params.idResult));

        if (!result.files) {
            throw new ApiError(404, "Result has no files.");
        }

        const filePaths = JSON.parse(result.files);
        const fileIndex = Number(req.params.fileIndex);

        if (fileIndex >= filePaths.length) {
            throw new ApiError(404, "Requested file does not exist.");
        }

        let data = prepareDataForDownload(
            [filePaths[fileIndex]],
            `Result_${result.id}`
        );
        res.set("Content-Type", "application/zip");
        res.set("Content-Disposition", "attachment; filename=" + data.name);
        return res.send(data.zipBuffer);
    }

    static async deleteResult(req, res) {
        await Result.del(Number(req.params.idResult));
        return res.sendStatus(204);
    }

    static async removeFromVolume(req, res) {
        await Result.removeFromVolume(
            Number(req.params.idResult),
            Number(req.params.idVolume)
        );
        return res.sendStatus(204);
    }
}
