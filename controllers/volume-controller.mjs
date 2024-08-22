// @ts-check

import { Volume } from "../models/volume.mjs";
import { RawVolumeData } from "../models/raw-volume-data.mjs";
import appConfig from "../tools/config.mjs";
import { SparseLabeledVolumeData } from "../models/sparse-labeled-volume-data.mjs";
import { PseudoLabeledVolumeData } from "../models/pseudo-labeled-volume-data.mjs";
import path from "path";
import fileSystem from "fs";
import { rm } from "node:fs/promises";
import { rawToTiff } from "../tools/raw-to-tiff.mjs";

export class VolumeController {
    static async createVolume(req, res) {
        console.log("Creating a new volume");
        try {
            await Volume.create(
                req.body.name,
                req.body.description,
                req.session.user.id,
                Number(req.params.id)
            );

            console.log("Volume successfully created.");
            res.redirect(`/api/actions/projects/details/${req.params.id}`);
        } catch (err) {
            console.error("Error in creating volume:", err);
            res.status(500).send(err);
        }
    }

    static async removeVolume(req, res) {
        console.log(`Deleting Volume ${req.params.idVolume}`);
        try {
            await Volume.del(Number(req.params.idVolume));

            res.redirect(
                `/api/actions/projects/details/${req.params.idProject}`
            );
        } catch (err) {
            console.error("Error in creating volume:", err);
            res.status(500).send(err);
        }
    }

    static async uploadRawData(req, res) {
        console.log(`Uploading raw data for volume ${req.params.idVolume}`);
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

                const volume = await Volume.getByIdDeep(
                    Number(req.params.idVolume),
                    { rawData: true }
                );
                let rawVolumeData;
                if (!volume.rawData) {
                    rawVolumeData = await RawVolumeData.create(
                        Number(req.session.user.id),
                        Number(req.params.idVolume)
                    );
                } else {
                    rawVolumeData = RawVolumeData.fromReference(volume.rawData);
                }
                await RawVolumeData.uploadFiles(rawVolumeData.id, files);

                res.redirect(
                    `/api/actions/projects/details/` + req.params.idProject
                );
            }
        } catch (err) {
            res.status(500).send(err);
        }
    }

    static async uploadMrcFile(req, res) {
        console.log(`Uploading raw data for volume ${req.params.idVolume}`);
        try {
            if (!req.files || !req.files.files) {
                res.send({
                    status: false,
                    message: "No file uploaded",
                });
            } else {
                // await volumeController.addRawVolumeMrcFile(req.params.idVolume, req.session.user.id, req.files.files);
                const volume = await Volume.getByIdDeep(
                    Number(req.params.idVolume),
                    { rawData: true }
                );
                let rawVolumeData;
                if (!volume.rawData) {
                    rawVolumeData = await RawVolumeData.create(
                        Number(req.session.user.id),
                        Number(req.params.idVolume)
                    );
                } else {
                    rawVolumeData = RawVolumeData.fromReference(volume.rawData);
                }

                await rawVolumeData.uploadMrcFile(req.files.files);

                console.log("Mrc Data successfully uploaded.");

                res.redirect(
                    `/api/actions/projects/details/` + req.params.idProject
                );
            }
        } catch (err) {
            res.status(500).send(err);
        }
    }

    static async addSparseLabeledVolume(req, res) {
        try {
            const volume = await Volume.getByIdDeep(
                Number(req.params.idVolume),
                { sparseVolumes: true }
            );
            if (
                volume.sparseVolumes.length >=
                appConfig.projects.maxVolumeChannels
            ) {
                throw new Error(
                    `Volume ${volume.id} (${volume.name}): Maximum amount of volumes in a sparse volume stack reached (${appConfig.projects.maxVolumeChannels})`
                );
            }
            await SparseLabeledVolumeData.create(
                Number(req.session.user.id),
                Number(req.params.idVolume)
            );
            console.log(
                `Volume ${volume.id} (${volume.name}): Sparse labeled volume successfully added.`
            );

            res.redirect(
                `/api/actions/projects/details/${req.params.idProject}`
            );
        } catch (err) {
            console.error("Error in creating volume:", err);
            res.status(500).send(err);
        }
    }

    static async addPseudoLabeledVolume(req, res) {
        try {
            const volume = await Volume.getByIdDeep(
                Number(req.params.idVolume),
                { pseudoVolumes: true }
            );
            if (
                volume.sparseVolumes.length >=
                appConfig.projects.maxVolumeChannels
            ) {
                throw new Error(
                    `Volume ${volume.id} (${volume.name}): Maximum amount of volumes in a pseudo volume stack reached (${appConfig.projects.maxVolumeChannels})`
                );
            }
            await PseudoLabeledVolumeData.create(
                Number(req.session.user.id),
                Number(req.params.idVolume)
            );
            console.log(
                `Volume ${volume.id} (${volume.name}): Pseudo labeled volume successfully added.`
            );

            res.redirect(
                `/api/actions/projects/details/${req.params.idProject}`
            );
        } catch (err) {
            console.error("Error in creating volume:", err);
            res.status(500).send(err);
        }
    }

    static async testTiffConversion(req, res) {
        try {
            const volume = await Volume.getByIdDeep(
                Number(req.params.idVolume),
                { rawData: true, sparseVolumes: true }
            );
            const promises = [];
            if (volume.rawData != null) {
                const rawTiffFolderPath = path.join(
                    volume.rawData.path,
                    "tiff-test",
                    "raw"
                );
                if (fileSystem.existsSync(rawTiffFolderPath)) {
                    await rm(rawTiffFolderPath, {
                        recursive: true,
                        force: true,
                    });
                }
                const rawData = RawVolumeData.fromReference(volume.rawData);
                promises.push(rawToTiff(rawData, rawTiffFolderPath));
            }
            if (
                volume.sparseVolumes != null &&
                volume.sparseVolumes.length > 0
            ) {
                const sparseLabelsTiffFolderPath = path.join(
                    volume.sparseVolumes[0].path,
                    "tiff-test",
                    "sparseLabels"
                );
                if (fileSystem.existsSync(sparseLabelsTiffFolderPath)) {
                    await rm(sparseLabelsTiffFolderPath, {
                        recursive: true,
                        force: true,
                    });
                }
                const sparseVolumes = [];
                for (const sparseVolume of volume.sparseVolumes) {
                    sparseVolumes.push(
                        SparseLabeledVolumeData.fromReference(sparseVolume)
                    );
                }
                promises.push(
                    rawToTiff(sparseVolumes, sparseLabelsTiffFolderPath)
                );
            }
            await Promise.all(promises);
            console.log(
                `Volume ${volume.id} (${volume.name}): Tiff conversion test done.`
            );

            res.redirect(
                `/api/actions/projects/details/${req.params.idProject}`
            );
        } catch (err) {
            console.error("Error in creating volume:", err);
            res.status(500).send(err);
        }
    }

    // async createPseudoLabels(volumeId, illastik) {
    //     volumeId = Number(volumeId);

    //     const outputPath = path.join("data", "pseudoTest");
    //     if (!fileSystem.existsSync(outputPath)) {
    //         fileSystem.mkdirSync(outputPath, {recursive: true});
    //     }
    //     const volume = this.getById(volumeId);
    //     const rawData = lowdbVolumeDataController.getById(volume.rawDataId);
    //     const sparseLabelStack = lowdbVolumeDataController.getByIds(volume.sparseLabeledVolumes.ids)

    //     console.log(rawData)
    //     illastik.generateLabels(rawData, sparseLabelStack, outputPath, outputPath);
    // }
}
