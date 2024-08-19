// @ts-check

import { RawVolumeData } from "../models/raw-volume-data.mjs";
import { publicDataPath, publicPath } from "../tools/utils.mjs";
import {
    VolumeDataFactory,
    VolumeDataType,
} from "../models/volume-data-factory.mjs";

export class VolumeDataController {
    /**
     * @param {VolumeDataType} type
     */
    static async visualizeSingleVolume(type, req, res) {
        try {
            const volumeData = await VolumeDataFactory.getClass(type).getById(
                Number(req.params.idVolumeData)
            );
            if (!volumeData.rawFile) {
                throw new Error(
                    "Visualisation requires the volume data to contain a .raw file."
                );
            }

            if (!volumeData.settingsFile) {
                throw new Error(
                    "Visualisation requires the volume data to contain a settings file."
                );
            }

            if (volumeData.rawFile.fileExtension !== ".raw") {
                throw new Error(
                    "Web renderer currently only supports the visualisation of .raw files."
                );
            }

            const visualizationFiles = [];

            visualizationFiles.push({
                path: publicDataPath(
                    req.originalUrl,
                    volumeData.rawFile.filePath
                ),
                filename: volumeData.rawFile.fileName,
            });
            visualizationFiles.push({
                path: publicDataPath(
                    req.originalUrl,
                    volumeData.settingsFile.filePath
                ),
                filename: volumeData.settingsFile.fileName,
            });
            visualizationFiles.push({
                path: publicPath(req.originalUrl, "data/session.json"),
                filename: "session.json",
            });
            visualizationFiles.push({
                path: publicPath(req.originalUrl, "data/tf-default.json"),
                filename: "tf-default.json",
            });

            const configData = { files: [] };

            for (let i = 0; i < 5; i++) {
                configData["files"].push(volumeData.settingsFile.fileName);
            }

            const volumesJSON = JSON.stringify(visualizationFiles).replaceAll(
                "\\",
                "\\\\"
            );
            const configJSON = JSON.stringify(configData);

            res.render("visualize-volume", {
                volumeName: "test",
                volumes: volumesJSON,
                config: configJSON,
            });
        } catch (err) {
            res.status(500).send(err);
        }
    }

    /**
     * @param {VolumeDataType} type
     */
    static async addFiles(type, req, res) {
        try {
            if (!req.files || !req.files.files) {
                res.send({
                    status: false,
                    message: "No file uploaded",
                });
            } else {
                const volumeData = await VolumeDataFactory.getClass(
                    type
                ).getById(Number(req.params.idVolumeData));
                volumeData.uploadFiles(req.files.files);
                res.redirect(
                    `/api/actions/projects/details/` + req.params.idProject
                );
            }
        } catch (err) {
            res.status(500).send(err);
            console.log(err);
        }
    }

    /**
     * @param {VolumeDataType} type
     */
    static async addMrcFile(type, req, res) {
        try {
            if (type != VolumeDataType.RawVolumeData) {
                throw Error("This operation is only avaliable on Raw Volumes.");
            }
            if (!req.files || !req.files.files) {
                res.send({
                    status: false,
                    message: "No file uploaded",
                });
            } else {
                const volumeData = await RawVolumeData.getById(
                    Number(req.params.idVolumeData)
                );
                volumeData.uploadMrcFile(req.files.files);
                res.redirect(
                    `/api/actions/projects/details/` + req.params.idProject
                );
            }
        } catch (err) {
            res.status(500).send(err);
            console.log(err);
        }
    }

    /**
     * @param {VolumeDataType} type
     */
    static async downloadFullVolumeData(type, req, res) {
        try {
            const volumeData = await VolumeDataFactory.getClass(type).getById(
                Number(req.params.idVolumeData)
            );
            let data = volumeData.prepareDataForDownload();
            res.set("Content-Type", "application/zip");
            res.set("Content-Disposition", "attachment; filename=" + data.name);
            res.send(data.zipBuffer);
        } catch (err) {
            res.status(500).send(err);
        }
    }

    /**
     * @param {VolumeDataType} type
     */
    static async downloadRawFile(type, req, res) {
        try {
            const volumeData = await VolumeDataFactory.getClass(type).getById(
                Number(req.params.idVolumeData)
            );
            let data = volumeData.rawFile.prepareDataForDownload();
            res.set("Content-Type", "application/zip");
            res.set("Content-Disposition", "attachment; filename=" + data.name);
            res.send(data.zipBuffer);
        } catch (err) {
            res.status(500).send(err);
        }
    }

    /**
     * @param {VolumeDataType} type
     */
    static async downloadSettingsFile(type, req, res) {
        try {
            const volumeData = await VolumeDataFactory.getClass(type).getById(
                Number(req.params.idVolumeData)
            );
            let data = volumeData.settingsFile.prepareDataForDownload();
            res.set("Content-Type", "application/zip");
            res.set("Content-Disposition", "attachment; filename=" + data.name);
            res.send(data.zipBuffer);
        } catch (err) {
            res.status(500).send(err);
        }
    }

    /**
     * @param {VolumeDataType} type
     */
    static async downloadMrcFile(type, req, res) {
        try {
            if (type != VolumeDataType.RawVolumeData) {
                throw Error("This operation is only avaliable on Raw Volumes.");
            }
            const volumeData = await RawVolumeData.getById(
                Number(req.params.idVolumeData)
            );
            let data = volumeData.mrcFile.prepareDataForDownload();
            res.set("Content-Type", "application/zip");
            res.set("Content-Disposition", "attachment; filename=" + data.name);
            res.send(data.zipBuffer);
        } catch (err) {
            res.status(500).send(err);
        }
    }

    /**
     * @param {VolumeDataType} type
     */
    static async deleteFullVolumeData(type, req, res) {
        try {
            await VolumeDataFactory.getClass(type).del(
                Number(req.params.idVolumeData)
            );
            res.redirect(
                `/api/actions/projects/details/` + req.params.idProject
            );
        } catch (err) {
            res.status(500).send(err);
        }
    }

    /**
     * @param {VolumeDataType} type
     */
    static async removeRawFile(type, req, res) {
        try {
            await VolumeDataFactory.getClass(type).removeRawFile(
                Number(req.params.idVolumeData)
            );
            res.redirect(
                `/api/actions/projects/details/` + req.params.idProject
            );
        } catch (err) {
            res.status(500).send(err);
        }
    }

    /**
     * @param {VolumeDataType} type
     */
    static async removeSettingsFile(type, req, res) {
        try {
            await VolumeDataFactory.getClass(type).removeSettingsFile(
                Number(req.params.idVolumeData)
            );
            res.redirect(
                `/api/actions/projects/details/` + req.params.idProject
            );
        } catch (err) {
            res.status(500).send(err);
        }
    }

    /**
     * @param {VolumeDataType} type
     */
    static async removeMrcFile(type, req, res) {
        try {
            if (type != VolumeDataType.RawVolumeData) {
                throw Error("This operation is only avaliable on Raw Volumes.");
            }
            await RawVolumeData.removeMrcFile(Number(req.params.idVolumeData));
            res.redirect(
                `/api/actions/projects/details/` + req.params.idProject
            );
        } catch (err) {
            res.status(500).send(err);
        }
    }
}
