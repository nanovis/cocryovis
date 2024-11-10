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
     */
    static async getById(type, req, res) {
        const volumeData = await VolumeDataFactory.getClass(type).getById(
            Number(req.params.idVolumeData)
        );

        return res.json(volumeData);
    }

    /**
     * @param {VolumeDataType} type
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

        return res.status(201).json(volumeData);
    }

    /**
     * @param {VolumeDataType} type
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

        const volumeData = RawVolumeData.createFromMrcFile(
            req.session.user.id,
            Number(req.params.idVolume),
            req.files.files
        );

        return res.status(201).json(volumeData);
    }

    /**
     * @param {VolumeDataType} type
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
        return res.send(data.zipBuffer);
    }

    /**
     * @param {VolumeDataType} type
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
        return res.send(data.zipBuffer);
    }

    /**
     * @param {VolumeDataType} type
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
        return res.send(data.zipBuffer);
    }

    /**
     * @param {VolumeDataType} type
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
        return res.send(data.zipBuffer);
    }

    /**
     * @param {VolumeDataType} type
     */
    static async removeFromVolume(type, req, res) {
        await VolumeDataFactory.getClass(type).removeFromVolume(
            Number(req.params.idVolumeData),
            Number(req.params.idVolume)
        );

        return res.sendStatus(204);
    }
}
