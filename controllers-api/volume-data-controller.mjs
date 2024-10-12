// @ts-check

import RawVolumeData from "../models/raw-volume-data.mjs";
import {
    VolumeDataFactory,
    VolumeDataType,
} from "../models/volume-data-factory.mjs";
import path from "path";
import { ApiError } from "../tools/error-handler.mjs";
import appConfig from "../tools/config.mjs";

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
    static async visualizeSingleVolume(type, req, res) {
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

        const serverURL = `${req.protocol}://${req.get("host")}`;

        const visualizationFiles = [];

        const rawFileReference = {
            url: new URL(
                path.relative(appConfig.dataPath, volumeData.rawFilePath),
                serverURL
            ).toString(),
            filename: path.basename(volumeData.rawFilePath),
        };
        const settingsReference = {
            data: JSON.parse(volumeData.settings),
            filename: `${path.parse(volumeData.rawFilePath).name}.json`,
        };

        visualizationFiles.push(rawFileReference);
        visualizationFiles.push({
            url: new URL("/data/session.json", serverURL).toString(),
            filename: "session.json",
        });
        visualizationFiles.push({
            url: new URL("/data/tf-default.json", serverURL).toString(),
            filename: "tf-default.json",
        });

        const configData = { files: [settingsReference.filename] };

        return res.json({
            settingsReference: settingsReference,
            files: visualizationFiles,
            config: configData,
        });
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
    static async addFiles(type, req, res) {
        if (!req.files || !req.files.files) {
            throw new ApiError(400, "No file uploaded");
        }

        let files = req.files.files;
        if (!Array.isArray(files)) {
            files = [files];
        }

        const volumeData = await VolumeDataFactory.getClass(type).uploadFiles(
            Number(req.params.idVolumeData),
            files
        );

        return res.json(volumeData);
    }

    /**
     * @param {VolumeDataType} type
     */
    static async addMrcFile(type, req, res) {
        if (type != VolumeDataType.RawVolumeData) {
            throw new ApiError(
                400,
                "This operation is only avaliable on Raw Volumes."
            );
        }

        if (!req.files || !req.files.files) {
            throw new ApiError(404, "No file uploaded");
        }

        const volumeData = RawVolumeData.uploadMrcFile(
            Number(req.params.idVolumeData),
            req.files.files
        );
        return res.json(volumeData);
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
    static async deleteFullVolumeData(type, req, res) {
        await VolumeDataFactory.getClass(type).del(
            Number(req.params.idVolumeData)
        );

        return res.sendStatus(204);
    }

    /**
     * @param {VolumeDataType} type
     */
    static async removeRawFile(type, req, res) {
        await VolumeDataFactory.getClass(type).removeRawFile(
            Number(req.params.idVolumeData)
        );

        return res.sendStatus(204);
    }

    /**
     * @param {VolumeDataType} type
     */
    static async removeMrcFile(type, req, res) {
        if (type != VolumeDataType.RawVolumeData) {
            throw new ApiError(
                400,
                "This operation is only avaliable on Raw Volumes."
            );
        }
        await RawVolumeData.removeMrcFile(Number(req.params.idVolumeData));

        return res.sendStatus(204);
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
