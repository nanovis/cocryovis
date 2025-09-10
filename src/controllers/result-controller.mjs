// @ts-check

import path from "path";
import Result from "../models/result.mjs";
import { ApiError } from "../tools/error-handler.mjs";
import fileSystem from "fs";
import archiver from "archiver";
import Utils from "../tools/utils.mjs";
import appConfig from "../tools/config.mjs";
import { idResult } from "#schemas/componentSchemas/result-schema.mjs";
import validateSchema from "../tools/validate-schema.mjs";
import { idVolume } from "#schemas/componentSchemas/volume-schema.mjs";

/**
 * @typedef { import("express").Request } Request
 * @typedef { import("express").Response } Response
 */

export default class ResultController {
    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async getById(req, res) {
        const { params } = validateSchema(req, { paramsSchema: idResult });

        const result = await Result.getById(params.idResult);

        res.json(result);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async getDetails(req, res) {
        const result = await Result.getByIdDeep(Number(req.params.idResult), {
            checkpoint: true,
            files: true,
        });

        res.json(result);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async getFromVolume(req, res) {
        const { params } = validateSchema(req, { paramsSchema: idVolume });

        const result = await Result.getFromVolume(params.idVolume, {
            checkpoint: true,
        });

        res.json(result);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async delete(req, res) {
        const { params } = validateSchema(req, {
            paramsSchema: idResult,
        });

        await Result.del(params.idResult);

        res.sendStatus(204);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async getResultData(req, res) {
        const { params } = validateSchema(req, { paramsSchema: idResult });

        const result = await Result.getByIdDeep(params.idResult, {
            files: true,
        });
        if (result.files.length === 0) {
            throw new ApiError(
                400,
                "Visualisation requires the result to contain at least one file."
            );
        }

        const archive = archiver("zip", {
            zlib: { level: appConfig.compressionLevel },
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
     * @param {Request} req
     * @param {Response} res
     */
    static async createFromFiles(req, res) {
        const { params } = validateSchema(req, { paramsSchema: idVolume });

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
            params.idVolume,
            data.volumeDescriptors,
            files
        );

        res.json(result);
    }
}
