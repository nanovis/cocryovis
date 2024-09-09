// @ts-check

import { RawVolumeData } from "../models/raw-volume-data.mjs";
import {
    createTemporaryFolder,
    publicDataPath,
    publicPath,
} from "../tools/utils.mjs";
import {
    VolumeDataFactory,
    VolumeDataType,
} from "../models/volume-data-factory.mjs";
import path from "path";

export class VolumeDataController {
    /**
     * @param {VolumeDataType} type
     */
    static async visualizeSingleVolume(type, req, res) {
        try {
            const volumeData = await VolumeDataFactory.getClass(type).getById(
                Number(req.params.idVolumeData)
            );
            if (!volumeData.rawFilePath) {
                throw new Error(
                    "Visualisation requires the volume data to contain a .raw file."
                );
            }

            if (!volumeData.settings) {
                throw new Error(
                    "Visualisation requires the volume data to contain a settings file."
                );
            }

            const visualizationFiles = [];

            const rawFileReference = {
                path: publicDataPath(req.originalUrl, volumeData.rawFilePath),
                filename: path.basename(volumeData.rawFilePath),
            };
            const settingsReference = {
                data: volumeData.settings,
                filename: `${path.parse(volumeData.rawFilePath).name}.json`,
            };

            visualizationFiles.push(rawFileReference);
            visualizationFiles.push({
                path: publicPath(req.originalUrl, "data/session.json"),
                filename: "session.json",
            });
            visualizationFiles.push({
                path: publicPath(req.originalUrl, "data/tf-default.json"),
                filename: "tf-default.json",
            });

            const configData = { files: [settingsReference.filename] };

            const volumesJSON = JSON.stringify(visualizationFiles).replaceAll(
                "\\",
                "\\\\"
            );
            const configJSON = JSON.stringify(configData);
            const settingsReferenceJSON = JSON.stringify(
                settingsReference
            ).replaceAll("\\", "\\\\");

            res.render("visualize-volume", {
                volumeName: "test",
                projectId: Number(req.params.idProject),
                volumeId: Number(req.params.idVolume),
                settingsReference: settingsReferenceJSON,
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
                let files = req.files.files;
                if (!Array.isArray(files)) {
                    files = [files];
                }

                const volumeData = await VolumeDataFactory.getClass(
                    type
                ).uploadFiles(Number(req.params.idVolumeData), files);

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
                RawVolumeData.uploadMrcFile(
                    Number(req.params.idVolumeData),
                    req.files.files
                );
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
            let data = await VolumeDataFactory.getClass(
                type
            ).prepareDataForDownload(Number(req.params.idVolumeData));
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
            let data = await VolumeDataFactory.getClass(
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
        } catch (err) {
            res.status(500).send(err);
        }
    }

    /**
     * @param {VolumeDataType} type
     */
    static async downloadSettingsFile(type, req, res) {
        try {
            let data = await VolumeDataFactory.getClass(
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
            let data = await RawVolumeData.prepareDataForDownload(
                Number(req.params.idVolumeData),
                false,
                false,
                true
            );
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

    /**
     * @param {VolumeDataType} type
     */
    static async removeFromVolume(type, req, res) {
        try {
            await VolumeDataFactory.getClass(type).removeFromVolume(
                Number(req.params.idVolumeData),
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
