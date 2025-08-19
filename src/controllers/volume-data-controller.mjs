// @ts-check

import RawVolumeData from "../models/raw-volume-data.mjs";
import {
    VolumeDataFactory,
    VolumeDataType,
} from "../models/volume-data-factory.mjs";
import path from "path";
import { ApiError } from "../tools/error-handler.mjs";
import fileSystem from "fs";
import archiver from "archiver";
import Utils from "../tools/utils.mjs";
import {
    PendingData,
    PendingLocalFile,
    unpackFiles,
} from "../tools/file-handler.mjs";
import fsPromises from "node:fs/promises";
import { fetchCtyoETTomogramMetadata } from "../tools/cryoET.mjs";
import SparseLabeledVolumeData from "../models/sparse-labeled-volume-data.mjs";
import appConfig from "../tools/config.mjs";
import validateSchema from "../tools/validate-schema.mjs";
import {
    fromUrlSchema,
    idVolumeAndType,
    idVolumeDataAndType,
    idVolumeVolumeDataTypeParams,
    updateAnnotations,
    volumeDataUpdate,
} from "#schemas/volume-data-path-schema.mjs";
import { idTomogram } from "#schemas/cryoEt-path-schema.mjs";

/**
 * @typedef { import("express").Request } Request
 * @typedef { import("express").Response } Response
 */

export default class VolumeDataController {
    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async getById(req, res) {
        const { params } = validateSchema(req, {
            paramsSchema: idVolumeDataAndType,
        });

        const volumeData = await VolumeDataFactory.getClass(
            VolumeDataType.mapName(params.type)
        ).getById(params.idVolumeData);

        res.json(volumeData);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async update(req, res) {
        const { params, body } = validateSchema(req, {
            paramsSchema: idVolumeDataAndType,
            bodySchema: volumeDataUpdate,
        });

        const volumeData = await VolumeDataFactory.getClass(
            VolumeDataType.mapName(params.type)
        ).update(params.idVolumeData, body);
        res.status(200).json(volumeData);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async getData(req, res) {
        const { params } = validateSchema(req, {
            paramsSchema: idVolumeDataAndType,
        });
        const volumeData = await VolumeDataFactory.getClass(
            VolumeDataType.mapName(params.type)
        ).getById(params.idVolumeData);

        if (!volumeData.rawFilePath) {
            throw new ApiError(400, "Volume Data is missing a raw file.");
        }

        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${path.basename(volumeData.rawFilePath)}"`
        );
        const fileStream = fileSystem.createReadStream(volumeData.rawFilePath);
        fileStream.pipe(res);

        fileStream.on("error", (err) => {
            console.error("File streaming error:", err);
            throw new ApiError(500, "Error reading file.");
        });
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async getVolumeVisualizationFiles(req, res) {
        const { params } = validateSchema(req, {
            paramsSchema: idVolumeDataAndType,
        });

        const volumeData = await VolumeDataFactory.getClass(
            VolumeDataType.mapName(params.type)
        ).getById(params.idVolumeData);
        if (!volumeData.rawFilePath) {
            throw new ApiError(
                400,
                "Visualisation requires the volume data to contain a .raw file."
            );
        }

        if (!volumeData.settings) {
            throw new ApiError(
                400,
                "Visualisation requires the volume data to contain a settings file."
            );
        }

        const archive = archiver("zip", {
            zlib: { level: appConfig.compressionLevel },
        });

        res.setHeader("Content-Type", "application/zip");
        res.setHeader(
            "Content-Disposition",
            'attachment; filename="volume.zip"'
        );
        archive.pipe(res);

        await Utils.packVisualizationArchive(
            archive,
            [JSON.parse(volumeData.settings)],
            [volumeData.rawFilePath]
        );

        archive.finalize();
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async createFromFiles(req, res) {
        const { params } = validateSchema(req, {
            paramsSchema: idVolumeAndType,
        });

        if (!req.files || !req.files.files) {
            throw new ApiError(400, "No file uploaded");
        }

        let files = req.files.files;
        if (!Array.isArray(files)) {
            files = [files];
        }

        const VolumeDataClass = VolumeDataFactory.getClass(
            VolumeDataType.mapName(params.type)
        );

        const unpackedFiles = await unpackFiles(
            files,
            VolumeDataClass.acceptedFileExtensions
        );

        const volumeData = await VolumeDataClass.createFromFiles(
            req.session.user.id,
            params.idVolume,
            unpackedFiles
        );

        res.status(201).json(volumeData);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async createFromMrcFile(req, res) {
        const { params } = validateSchema(req, {
            paramsSchema: idVolumeAndType,
        });

        if (
            VolumeDataType.mapName(params.type) != VolumeDataType.RawVolumeData
        ) {
            throw new ApiError(
                400,
                "This operation is only avaliable on Raw Volumes."
            );
        }

        if (!req.files || !req.files.files) {
            throw new ApiError(400, "No file uploaded");
        }

        if (Array.isArray(req.files.files)) {
            throw new ApiError(400, "Too many files uploaded.");
        }

        const unpackedFiles = await unpackFiles([req.files.files], [".mrc"]);
        if (unpackedFiles.length == 0) {
            throw new ApiError(400, "No valid MRC file found.");
        }

        const volumeData = await RawVolumeData.createFromMrcFile(
            req.session.user.id,
            params.idVolume,
            unpackedFiles[0]
        );

        res.status(201).json(volumeData);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async createFromUrl(req, res) {
        const { params, body } = validateSchema(req, {
            paramsSchema: idVolumeAndType,
            bodySchema: fromUrlSchema,
        });

        if (
            VolumeDataType.mapName(params.type) != VolumeDataType.RawVolumeData
        ) {
            throw new ApiError(
                400,
                "This operation is only avaliable on Raw Volumes."
            );
        }

        const filePath = await Utils.downloadAndSaveFile(body.url);

        try {
            const file = new PendingLocalFile(filePath);
            let volumeData;

            if (req.body.fileType === "mrc") {
                volumeData = await RawVolumeData.createFromMrcFile(
                    req.session.user.id,
                    params.idVolume,
                    file
                );
            } else {
                const settingsFile = new PendingData(
                    Buffer.from(JSON.stringify(body.volumeSettings)),
                    "volume-settings.json"
                );

                volumeData = await RawVolumeData.createFromFiles(
                    req.session.user.id,
                    params.idVolume,
                    [file, settingsFile]
                );
            }

            res.status(201).json(volumeData);
        } catch (error) {
            await fsPromises.rm(filePath, {
                recursive: true,
                force: true,
            });

            throw error;
        }
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async downloadFullVolumeData(req, res) {
        const { params } = validateSchema(req, {
            paramsSchema: idVolumeDataAndType,
        });

        const data = await VolumeDataFactory.getClass(
            VolumeDataType.mapName(params.type)
        ).prepareDataForDownload(params.idVolumeData);

        res.type("application/zip");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${data.name}"`
        );
        data.archive.pipe(res);

        data.archive.finalize();
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async downloadRawFile(req, res) {
        const { params } = validateSchema(req, {
            paramsSchema: idVolumeDataAndType,
        });

        const data = await VolumeDataFactory.getClass(
            VolumeDataType.mapName(params.type)
        ).prepareDataForDownload(params.idVolumeData, true, false, false);

        res.type("application/zip");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${data.name}"`
        );
        data.archive.pipe(res);

        data.archive.finalize();
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async downloadSettingsFile(req, res) {
        const { params } = validateSchema(req, {
            paramsSchema: idVolumeDataAndType,
        });

        const data = await VolumeDataFactory.getClass(
            VolumeDataType.mapName(params.type)
        ).prepareDataForDownload(params.idVolumeData, false, true, false);

        res.type("application/zip");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${data.name}"`
        );
        data.archive.pipe(res);

        data.archive.finalize();
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async downloadMrcFile(req, res) {
        const { params } = validateSchema(req, {
            paramsSchema: idVolumeDataAndType,
        });

        if (
            VolumeDataType.mapName(params.type) != VolumeDataType.RawVolumeData
        ) {
            throw new ApiError(
                400,
                "This operation is only avaliable on Raw Volumes."
            );
        }
        const data = await RawVolumeData.prepareDataForDownload(
            params.idVolumeData,
            false,
            false,
            true
        );

        res.type("application/zip");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${data.name}"`
        );
        data.archive.pipe(res);

        data.archive.finalize();
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async removeFromVolume(req, res) {
        const { params } = validateSchema(req, {
            paramsSchema: idVolumeVolumeDataTypeParams,
        });

        await VolumeDataFactory.getClass(
            VolumeDataType.mapName(params.type)
        ).removeFromVolume(params.idVolumeData, params.idVolume);

        res.sendStatus(204);
    }

    /**
     * @param {VolumeDataType} type
     * @param {Request} req
     * @param {Response} res
     */
    static async setRawData(type, req, res) {
        if (!req.files || !req.files.file) {
            throw new ApiError(400, "No annotations file found.");
        }
        if (Array.isArray(req.files.file)) {
            throw new ApiError(400, "To many files uploaded.");
        }

        const VolumeDataClass = VolumeDataFactory.getClass(type);

        const unpackedFiles = await unpackFiles(
            [req.files.file],
            VolumeDataClass.acceptedFileExtensions
        );

        if (unpackedFiles.length > 1) {
            throw new ApiError(400, "To many files uploaded.");
        }

        const volumeData = await VolumeDataClass.setRawData(
            Number(req.params.idVolumeData),
            unpackedFiles[0]
        );

        res.status(200).json(volumeData);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async updateAnnotations(req, res) {
        const { params, body } = validateSchema(req, {
            paramsSchema: idVolumeVolumeDataTypeParams,
            bodySchema: updateAnnotations,
        });

        if (
            VolumeDataType.mapName(params.type) !=
            VolumeDataType.SparseLabeledVolumeData
        ) {
            throw new ApiError(
                400,
                "This operation is only avaliable on Manual Label Volumes."
            );
        }
        const saveAsNew = body.saveAsNew ?? false;

        const sparseLabel = await SparseLabeledVolumeData.updateAnnotations(
            params.idVolumeData,
            params.idVolume,
            body.annotation,
            saveAsNew
        );

        res.json(sparseLabel);
    }
}
