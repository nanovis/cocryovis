// @ts-check

import Volume from "../models/volume.mjs";
import RawVolumeData from "../models/raw-volume-data.mjs";
import appConfig from "../tools/config.mjs";
import SparseLabeledVolumeData from "../models/sparse-labeled-volume-data.mjs";
import PseudoLabeledVolumeData from "../models/pseudo-labeled-volume-data.mjs";
import IlastikHandler from "../tools/ilastik-handler.mjs";
import { ApiError } from "../tools/error-handler.mjs";

export default class VolumeController {
    static async createVolume(req, res) {
        const volume = await Volume.create(
            req.body.name,
            req.body.description,
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
            throw new ApiError(404, "No file uploaded");
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
            throw new ApiError(404, "No file uploaded");
        }

        const volume = await Volume.getByIdDeep(Number(req.params.idVolume), {
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
        const volume = await Volume.getByIdDeep(Number(req.params.idVolume), {
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
        const volume = await Volume.getByIdDeep(Number(req.params.idVolume), {
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
        if (!Array.isArray(req.body)) {
            throw new ApiError(400, "No annotations found.");
        }

        const sparseLabel = await Volume.addAnnotations(
            Number(req.params.idVolume),
            Number(req.session.user.id),
            req.body[0]
        );

        return res.json(sparseLabel);
    }
}
