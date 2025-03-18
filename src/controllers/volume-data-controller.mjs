// @ts-check

import RawVolumeData from "../models/raw-volume-data.mjs";
import {
    VolumeDataFactory,
    VolumeDataType,
} from "../models/volume-data-factory.mjs";
import path from "path";
import { ApiError } from "../tools/error-handler.mjs";
import fileSystem, { fstat } from "fs";
import archiver from "archiver";
import Utils from "../tools/utils.mjs";
import {
    PendingData,
    PendingLocalFile,
    unpackFiles,
} from "../tools/file-handler.mjs";
import fsPromises from "node:fs/promises";
import { fetchCtyoETTomogramMetadata } from "../tools/cryoET.mjs";
import Volume from "../models/volume.mjs";
import SparseLabeledVolumeData from "../models/sparse-labeled-volume-data.mjs";

/**
 * @typedef { import("express").Request } Request
 * @typedef { import("express").Response } Response
 */

export default class VolumeDataController {
    /**
     * @param {VolumeDataType} type
     * @param {Request} req
     * @param {Response} res
     */
    static async getById(type, req, res) {
        const volumeData = await VolumeDataFactory.getClass(type).getById(
            Number(req.params.idVolumeData)
        );

        res.json(volumeData);
    }

    /**
     * @param {VolumeDataType} type
     * @param {Request} req
     * @param {Response} res
     */
    static async update(type, req, res) {
        if (!req.body) {
            throw new ApiError(400, "No data provided.");
        }

        delete req.body.path;
        delete req.body.rawFilePath;

        const volumeData = await VolumeDataFactory.getClass(type).update(
            Number(req.params.idVolumeData),
            req.body
        );
        res.status(200).json(volumeData);
    }

    /**
     * @param {VolumeDataType} type
     * @param {Request} req
     * @param {Response} res
     */
    static async getData(type, req, res) {
        const volumeData = await VolumeDataFactory.getClass(type).getById(
            Number(req.params.idVolumeData)
        );
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
     * @param {VolumeDataType} type
     * @param {Request} req
     * @param {Response} res
     */
    static async getVolumeVisualizationFiles(type, req, res) {
        const volumeData = await VolumeDataFactory.getClass(type).getById(
            Number(req.params.idVolumeData)
        );
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
            zlib: { level: 9 },
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
     * @param {VolumeDataType} type
     * @param {Request} req
     * @param {Response} res
     */
    static async createFromFiles(type, req, res) {
        if (!req.files || !req.files.files) {
            throw new ApiError(400, "No file uploaded");
        }

        let files = req.files.files;
        if (!Array.isArray(files)) {
            files = [files];
        }

        const VolumeDataClass = VolumeDataFactory.getClass(type);

        const unpackedFiles = await unpackFiles(
            files,
            VolumeDataClass.acceptedFileExtensions
        );

        const volumeData = await VolumeDataClass.createFromFiles(
            req.session.user.id,
            Number(req.params.idVolume),
            unpackedFiles
        );

        res.status(201).json(volumeData);
    }

    /**
     * @param {VolumeDataType} type
     * @param {Request} req
     * @param {Response} res
     */
    static async createFromMrcFile(type, req, res) {
        if (type != VolumeDataType.RawVolumeData) {
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
            Number(req.params.idVolume),
            unpackedFiles[0]
        );

        res.status(201).json(volumeData);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async createFromUrl(req, res) {
        if (!req.body.url || !Utils.isValidHttpUrl(req.body.url)) {
            throw new ApiError(400, "Invalid URL.");
        }

        if (!req.body.fileType) {
            throw new ApiError(400, "Missing file type.");
        }

        if (!["mrc", "raw"].includes(req.body.fileType)) {
            throw new ApiError(400, "Invalid file type.");
        }

        if (req.body.fileType === "raw" && !req.body.volumeSettings) {
            throw new ApiError(400, "Raw files require volume settings.");
        }

        const filePath = await Utils.downloadAndSaveFile(req.body.url);

        try {
            const file = new PendingLocalFile(filePath);
            let volumeData;

            if (req.body.fileType === "mrc") {
                volumeData = await RawVolumeData.createFromMrcFile(
                    req.session.user.id,
                    Number(req.params.idVolume),
                    file
                );
            } else {
                const settingsFile = new PendingData(
                    Buffer.from(req.body.volumeSettings),
                    "volume-settings.json"
                );

                volumeData = await RawVolumeData.createFromFiles(
                    req.session.user.id,
                    Number(req.params.idVolume),
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
     * @param {VolumeDataType} type
     * @param {Request} req
     * @param {Response} res
     */
    static async downloadFullVolumeData(type, req, res) {
        const data = await VolumeDataFactory.getClass(
            type
        ).prepareDataForDownload(Number(req.params.idVolumeData));

        res.type("application/zip");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${data.name}"`
        );
        data.archive.pipe(res);

        data.archive.finalize();
    }

    /**
     * @param {VolumeDataType} type
     * @param {Request} req
     * @param {Response} res
     */
    static async downloadRawFile(type, req, res) {
        const data = await VolumeDataFactory.getClass(
            type
        ).prepareDataForDownload(
            Number(req.params.idVolumeData),
            true,
            false,
            false
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
     * @param {VolumeDataType} type
     * @param {Request} req
     * @param {Response} res
     */
    static async downloadSettingsFile(type, req, res) {
        const data = await VolumeDataFactory.getClass(
            type
        ).prepareDataForDownload(
            Number(req.params.idVolumeData),
            false,
            true,
            false
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
     * @param {VolumeDataType} type
     * @param {Request} req
     * @param {Response} res
     */
    static async downloadMrcFile(type, req, res) {
        if (type != VolumeDataType.RawVolumeData) {
            throw new ApiError(
                400,
                "This operation is only avaliable on Raw Volumes."
            );
        }
        const data = await RawVolumeData.prepareDataForDownload(
            Number(req.params.idVolumeData),
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
     * @param {VolumeDataType} type
     * @param {Request} req
     * @param {Response} res
     */
    static async removeFromVolume(type, req, res) {
        await VolumeDataFactory.getClass(type).removeFromVolume(
            Number(req.params.idVolumeData),
            Number(req.params.idVolume)
        );

        res.sendStatus(204);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async getTomographyMetadataFromCryoETId(req, res) {
        const metadata = await fetchCtyoETTomogramMetadata(
            Number(req.params.idTomogram)
        );

        res.status(200).json(metadata);
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
     * @param {VolumeDataType} type
     * @param {Request} req
     * @param {Response} res
     */
    static async updateAnnotations(type, req, res) {
        if (type != VolumeDataType.SparseLabeledVolumeData) {
            throw new ApiError(
                400,
                "This operation is only avaliable on Manual Label Volumes."
            );
        }

        if (!req.files || !req.files.file) {
            throw new ApiError(400, "No annotations file found.");
        }
        if (Array.isArray(req.files.file)) {
            throw new ApiError(400, "To many files uploaded.");
        }
        const annotationsFile = await fsPromises.readFile(
            req.files.file.tempFilePath
        );

        const annotations = JSON.parse(annotationsFile.toString("utf8"));

        if (!Array.isArray(annotations)) {
            throw new ApiError(400, "Unknown annotations format.");
        }

        const sparseLabel = await SparseLabeledVolumeData.updateAnnotations(
            Number(req.params.idVolumeData),
            Number(req.params.idVolume),
            annotations
        );

        res.json(sparseLabel);
    }
}
