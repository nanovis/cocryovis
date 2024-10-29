// @ts-check

import Volume from "../models/volume.mjs";
import RawVolumeData from "../models/raw-volume-data.mjs";
import appConfig from "../tools/config.mjs";
import SparseLabeledVolumeData from "../models/sparse-labeled-volume-data.mjs";
import PseudoLabeledVolumeData from "../models/pseudo-labeled-volume-data.mjs";
import { ApiError } from "../tools/error-handler.mjs";
import fsPromises from "fs/promises";

export default class VolumeController {
    static async getVolume(req, res) {
        const options = VolumeController.#parseOptionQuery(req);
        const volume = await Volume.getById(
            Number(req.params.idVolume),
            options
        );

        return res.status(200).json(volume);
    }

    static async getVolumesFromProject(req, res) {
        const options = VolumeController.#parseOptionQuery(req);
        const volumes = await Volume.getVolumesFromProject(
            Number(req.params.idProject),
            options
        );

        return res.status(200).json(volumes);
    }

    /**
     * @returns {import("../models/volume.mjs").Options}
     */
    static #parseOptionQuery(req) {
        const options = {
            rawData: !!req?.query?.rawData,
            sparseVolumes: !!req?.query?.sparseVolumes,
            pseudoVolumes: !!req?.query?.pseudoVolumes,
            results: !!req?.query?.results,
            projects: !!req?.query?.projects,
        };

        return options;
    }

    static async createVolume(req, res) {
        const volume = await Volume.create(
            req.body.name,
            req.body.description,
            req.session.user.id,
            Number(req.params.idProject)
        );

        return res.status(201).json(volume);
    }

    static async cloneVolume(req, res) {
        const volume = await Volume.clone(
            Number(req.params.idVolume),
            req.session.user.id,
            Number(req.params.idProject)
        );
        return res.status(201).json(volume);
    }

    static async removeVolume(req, res) {
        await Volume.del(Number(req.params.idVolume));

        return res.sendStatus(204);
    }

    static async removeFromProject(req, res) {
        await Volume.removeFromProject(
            Number(req.params.idVolume),
            Number(req.params.idProject)
        );

        return res.sendStatus(204);
    }

    static async uploadRawData(req, res) {
        if (!req.files || !req.files.files) {
            throw new ApiError(400, "No file uploaded");
        }

        let files = req.files.files;
        if (!Array.isArray(files)) {
            files = [files];
        }

        const volume = await Volume.getById(Number(req.params.idVolume));
        let rawDataId = volume.rawDataId;
        if (!rawDataId) {
            rawDataId = (
                await RawVolumeData.create(
                    Number(req.session.user.id),
                    Number(req.params.idVolume)
                )
            ).id;
        }

        const rawData = await RawVolumeData.uploadFiles(rawDataId, files);

        return res.json(rawData);
    }

    static async uploadMrcFile(req, res) {
        if (!req.file || !req.file.files) {
            throw new ApiError(400, "No file uploaded");
        }

        const volume = await Volume.getById(Number(req.params.idVolume), {
            rawData: true,
        });
        let rawDataId = volume.rawDataId;
        if (!volume.rawData) {
            rawDataId = (
                await RawVolumeData.create(
                    Number(req.session.user.id),
                    Number(req.params.idVolume)
                )
            ).id;
        }

        const rawData = await RawVolumeData.uploadMrcFile(
            rawDataId,
            req.file.files
        );

        return res.json(rawData);
    }

    static async addSparseLabelVolume(req, res) {
        const volume = await Volume.getById(Number(req.params.idVolume), {
            sparseVolumes: true,
        });
        if (volume.sparseVolumes.length >= appConfig.maxVolumeChannels) {
            throw new ApiError(
                400,
                `Volume ${volume.id} (${volume.name}): Maximum amount of volumes in a sparse volume stack reached (${appConfig.maxVolumeChannels})`
            );
        }
        const sparseLabeledVolume = await SparseLabeledVolumeData.create(
            Number(req.session.user.id),
            Number(req.params.idVolume)
        );

        return res.json(sparseLabeledVolume);
    }

    static async addPseudoLabelVolume(req, res) {
        const volume = await Volume.getById(Number(req.params.idVolume), {
            pseudoVolumes: true,
        });
        if (volume.pseudoVolumes.length >= appConfig.maxVolumeChannels) {
            throw new ApiError(
                400,
                `Volume ${volume.id} (${volume.name}): Maximum amount of volumes in a pseudo volume stack reached (${appConfig.maxVolumeChannels})`
            );
        }
        const pseudoLabeledVolume = await PseudoLabeledVolumeData.create(
            Number(req.session.user.id),
            Number(req.params.idVolume)
        );

        return res.json(pseudoLabeledVolume);
    }

    static async addAnnotations(req, res) {
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

        if (!Array.isArray(annotations) || annotations.length < 1) {
            throw new ApiError(400, "No annotations found.");
        }

        const annotationEntry = annotations[0];

        if (
            !annotationEntry.dimensions ||
            !annotationEntry.kernelSize ||
            !annotationEntry.positions
        ) {
            throw new ApiError(400, "Annotation file missing required fields.");
        }

        if (
            !Array.isArray(annotationEntry.positions) ||
            annotationEntry.positions.length < 1
        ) {
            throw new ApiError(400, "No annotation entries found.");
        }

        const sparseLabel = await Volume.addAnnotations(
            Number(req.params.idVolume),
            Number(req.session.user.id),
            annotationEntry
        );

        return res.json(sparseLabel);
    }
}
