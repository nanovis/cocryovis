// @ts-check

import { Volume } from "../models/volume.mjs";
import { RawVolumeData } from "../models/raw-volume-data.mjs";
import appConfig from "../tools/config.mjs";
import { SparseLabeledVolumeData } from "../models/sparse-labeled-volume-data.mjs";
import { PseudoLabeledVolumeData } from "../models/pseudo-labeled-volume-data.mjs";
import path from "path";
import fileSystem from "fs";
import fsPromises from "node:fs/promises";
import { annotationsToVolume } from "../tools/annotations-to-volume.mjs";
// import { rawToTiff } from "../tools/raw-to-tiff.mjs";

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

    static async removeFromProject(req, res) {
        console.log(
            `Removing Volume ${req.params.idVolume} from Project ${req.params.idProject}`
        );
        try {
            await Volume.removeFromProject(
                Number(req.params.idVolume),
                Number(req.params.idProject)
            );

            res.redirect(
                `/api/actions/projects/details/${req.params.idProject}`
            );
        } catch (err) {
            console.error("Error:", err);
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

                const volume = await Volume.getById(
                    Number(req.params.idVolume)
                );
                let rawDataId = volume.rawDataId;
                if (!rawDataId) {
                    rawDataId = (
                        await RawVolumeData.create(
                            Number(req.session.user.id),
                            Number(req.params.idVolume)
                        )
                    ).id;
                }

                await RawVolumeData.uploadFiles(rawDataId, files);

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
                let rawDataId = volume.rawDataId;
                if (!volume.rawData) {
                    rawDataId = (
                        await RawVolumeData.create(
                            Number(req.session.user.id),
                            Number(req.params.idVolume)
                        )
                    ).id;
                }

                await RawVolumeData.uploadMrcFile(rawDataId, req.files.files);

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
                volume.pseudoVolumes.length >=
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
        // try {
        //     const volume = await Volume.getByIdDeep(
        //         Number(req.params.idVolume),
        //         { rawData: true, sparseVolumes: true }
        //     );
        //     const promises = [];
        //     if (volume.rawData != null) {
        //         const rawTiffFolderPath = path.join(
        //             volume.rawData.path,
        //             "tiff-test",
        //             "raw"
        //         );
        //         if (fileSystem.existsSync(rawTiffFolderPath)) {
        //             await rm(rawTiffFolderPath, {
        //                 recursive: true,
        //                 force: true,
        //             });
        //         }
        //         promises.push(rawToTiff([volume.rawData], rawTiffFolderPath));
        //     }
        //     const validSparseVolumes = [];
        //     for (const sparseVolume of volume.sparseVolumes) {
        //         if (sparseVolume.rawFilePath && sparseVolume.settings) {
        //             validSparseVolumes.push(sparseVolume);
        //         }
        //     }
        //     if (validSparseVolumes.length > 0) {
        //         const sparseLabelsTiffFolderPath = path.join(
        //             validSparseVolumes[0].path,
        //             "tiff-test",
        //             "sparseLabels"
        //         );
        //         if (fileSystem.existsSync(sparseLabelsTiffFolderPath)) {
        //             await rm(sparseLabelsTiffFolderPath, {
        //                 recursive: true,
        //                 force: true,
        //             });
        //         }
        //         promises.push(
        //             rawToTiff(validSparseVolumes, sparseLabelsTiffFolderPath)
        //         );
        //     }
        //     await Promise.all(promises);
        //     console.log(
        //         `Volume ${volume.id} (${volume.name}): Tiff conversion test done.`
        //     );
        //     res.redirect(
        //         `/api/actions/projects/details/${req.params.idProject}`
        //     );
        // } catch (err) {
        //     console.error("Error in creating volume:", err);
        //     res.status(500).send(err);
        // }
    }

    static async createPseudoLabels(illastik, req, res) {
        try {
            const volumeId = Number(req.params.idVolume);

            const outputPath = path.join("data", "pseudoTest");
            if (!fileSystem.existsSync(outputPath)) {
                fileSystem.mkdirSync(outputPath, { recursive: true });
            }

            const volume = await Volume.getByIdDeep(volumeId, {
                rawData: true,
                sparseVolumes: true,
                pseudoVolumes: true,
            });

            if (volume.pseudoVolumes.length > 0) {
                throw new Error("Volume already has pseudo labels.");
            }

            await illastik.generateLabels(
                volume.rawData,
                volume.sparseVolumes,
                outputPath,
                outputPath
            );
        } catch (err) {
            console.error("Error in pseudo labels:", err);
            res.status(500).send(err);
        }
    }

    static async addAnnotations(req, res) {
        try {
            console.log(`Starting annotation conversion...`);
            if (!Array.isArray(req.body)) {
                throw new Error("No annotations found.");
            }

            const spareLabel = await Volume.addAnnotations(
                Number(req.params.idVolume),
                Number(req.session.user.id),
                req.body[0]
            );

            console.log(`Annotated Volume saved to ${spareLabel.rawFilePath}`);
        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }
    }
}
