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

export default class VolumeDataController {
    /**
     * @param {VolumeDataType} type
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async getById(type, req, res) {
        const volumeData = await VolumeDataFactory.getClass(type).getById(
            Number(req.params.idVolumeData)
        );

        res.json(volumeData);
    }

    /**
     * @param {VolumeDataType} type
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
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
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
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
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async createFromFiles(type, req, res) {
        if (!req.files || !req.files.files) {
            throw new ApiError(400, "No file uploaded");
        }

        let files = req.files.files;
        if (!Array.isArray(files)) {
            files = [files];
        }

        const volumeData = await VolumeDataFactory.getClass(
            type
        ).createFromFiles(
            req.session.user.id,
            Number(req.params.idVolume),
            files
        );

        res.status(201).json(volumeData);
    }

    /**
     * @param {VolumeDataType} type
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
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

        const volumeData = RawVolumeData.createFromMrcFile(
            req.session.user.id,
            Number(req.params.idVolume),
            req.files.files
        );

        res.status(201).json(volumeData);
    }

    /**
     * @param {VolumeDataType} type
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async downloadFullVolumeData(type, req, res) {
        const data = await VolumeDataFactory.getClass(
            type
        ).prepareDataForDownload(Number(req.params.idVolumeData));
        res.type("application/zip");
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=" + data.name
        );
        res.send(data.zipBuffer);
    }

    /**
     * @param {VolumeDataType} type
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
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
        res.set("Content-Type", "application/zip");
        res.set("Content-Disposition", "attachment; filename=" + data.name);
        res.send(data.zipBuffer);
    }

    /**
     * @param {VolumeDataType} type
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
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
        res.set("Content-Type", "application/zip");
        res.set("Content-Disposition", "attachment; filename=" + data.name);
        res.send(data.zipBuffer);
    }

    /**
     * @param {VolumeDataType} type
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
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
        res.set("Content-Type", "application/zip");
        res.set("Content-Disposition", "attachment; filename=" + data.name);
        res.send(data.zipBuffer);
    }

    /**
     * @param {VolumeDataType} type
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async removeFromVolume(type, req, res) {
        await VolumeDataFactory.getClass(type).removeFromVolume(
            Number(req.params.idVolumeData),
            Number(req.params.idVolume)
        );

        res.sendStatus(204);
    }
}
