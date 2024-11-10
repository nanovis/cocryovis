// @ts-check

import path from "path";
import Result from "../models/result.mjs";
import { ApiError } from "../tools/error-handler.mjs";
import fileSystem from "fs";
import archiver from "archiver";
import Utils from "../tools/utils.mjs";

export default class ResultController {
    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async getById(req, res) {
        const result = await Result.getById(Number(req.params.idResult));

        return res.json(result);
    }

    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async getDetails(req, res) {
        const result = await Result.getByIdDeep(Number(req.params.idResult), {
            checkpoint: true,
            files: true,
        });

        return res.json(result);
    }

    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async getFromVolume(req, res) {
        const result = await Result.getFromVolume(Number(req.params.idVolume), {
            checkpoint: true,
        });

        return res.json(result);
    }

    // static async downloadResult(req, res) {
    //     const result = await Result.getByIdDeep(Number(req.params.idResult), {
    //         files: true,
    //     });

    //     if (!result.files) {
    //         throw new ApiError(400, "Result has no files.");
    //     }

    //     result.files.sort((a, b) => a.index - b.index);

    //     const configData = {
    //         rawVolumeChannel: result.rawVolumeChannel,
    //         files: [],
    //     };
    //     const zip = new AdmZip();

    //     for (const file of result.files) {
    //         zip.addLocalFile(path.join(result.folderPath, file.rawFileName));
    //         zip.addLocalFile(
    //             path.join(result.folderPath, file.settingsFileName)
    //         );
    //         configData.files.push(file.settingsFileName);
    //     }
    //     zip.addFile(
    //         "config.json",
    //         Buffer.from(JSON.stringify(configData, null, 4))
    //     );

    //     res.set("Content-Type", "application/zip");
    //     res.set(
    //         "Content-Disposition",
    //         `attachment; filename=Result_${result.id}`
    //     );
    //     return res.send(zip.toBuffer());
    // }

    // static async downloadResultFile(req, res) {
    //     const result = await Result.getById(Number(req.params.idResult));

    //     if (!result.files) {
    //         throw new ApiError(404, "Result has no files.");
    //     }

    //     const filePaths = JSON.parse(result.files);
    //     const fileIndex = Number(req.params.fileIndex);

    //     if (fileIndex >= filePaths.length) {
    //         throw new ApiError(404, "Requested file does not exist.");
    //     }

    //     let data = prepareDataForDownload(
    //         [filePaths[fileIndex]],
    //         `Result_${result.id}`
    //     );
    //     res.set("Content-Type", "application/zip");
    //     res.set("Content-Disposition", "attachment; filename=" + data.name);
    //     return res.send(data.zipBuffer);
    // }

    // /**
    //  * @param {AuthenticatedRequest} req
    //  * @param {import("express").Response} res
    //  */
    // static async deleteResult(req, res) {
    //     await Result.del(Number(req.params.idResult));
    //     return res.sendStatus(204);
    // }

    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async removeFromVolume(req, res) {
        const volumeId = Number(req.params.idVolume);

        const result = await Result.removeFromVolume(
            Number(req.params.idResult),
            volumeId
        );

        return res.sendStatus(204);
    }

    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async getResultData(req, res) {
        const result = await Result.getByIdDeep(Number(req.params.idResult), {
            files: true,
        });
        if (result.files.length === 0) {
            throw new ApiError(
                400,
                "Visualisation requires the result to contain at least one file."
            );
        }

        const archive = archiver("zip", {
            zlib: { level: 9 },
        });

        res.attachment(`Result_${result.id}.zip`);
        archive.pipe(res);

        const fileReferences = result.files;
        fileReferences.sort((a, b) => a.index - b.index);

        const settings = [];
        const rawFileNames = [];
        for (const reference of fileReferences) {
            const settingsReferenceFile = await fileSystem.promises.readFile(
                path.join(result.folderPath, reference.settingsFileName),
                "utf8"
            );
            const settingsReference = JSON.parse(
                settingsReferenceFile.toString()
            );
            settingsReference.name = reference.name;
            settings.push(settingsReference);

            rawFileNames.push(
                path.join(result.folderPath, reference.rawFileName)
            );
        }

        await Utils.packVisualizationArchive(
            archive,
            settings,
            rawFileNames,
            result.rawVolumeChannel
        );

        archive.finalize();
    }

    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async createFromFiles(req, res) {
        if (!req.files || !req.files.files) {
            throw new ApiError(400, "No file uploaded");
        }

        let files = req.files.files;
        if (!Array.isArray(files)) {
            files = [files];
        }

        const data = JSON.parse(req.body.data);

        const result = await Result.createFromFiles(
            req.session.user.id,
            data.idCheckpoint,
            data.idVolumeData,
            Number(req.params.idVolume),
            data.volumeDescriptors,
            files
        );

        return res.json(result);
    }
}
