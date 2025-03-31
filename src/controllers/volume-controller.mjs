// @ts-check

import Volume from "../models/volume.mjs";
import { ApiError } from "../tools/error-handler.mjs";
import fsPromises from "fs/promises";

/**
 * @typedef { import("express").Request } Request
 * @typedef { import("express").Response } Response
 */

export default class VolumeController {
    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async getVolume(req, res) {
        const options = VolumeController.#parseOptionQuery(req);
        const volume = await Volume.getById(
            Number(req.params.idVolume),
            options
        );

        res.status(200).json(volume);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async getVolumesFromProject(req, res) {
        const options = VolumeController.#parseOptionQuery(req);
        const volumes = await Volume.getVolumesFromProject(
            Number(req.params.idProject),
            options
        );

        res.status(200).json(volumes);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async getVolumesFromProjectDeep(req, res) {
        const volumes = await Volume.getVolumesFromProjectDeep(
            Number(req.params.idProject)
        );

        res.status(200).json(volumes);
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

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async createVolume(req, res) {
        const volume = await Volume.create(
            req.body.name,
            req.body.description,
            req.session.user.id,
            Number(req.params.idProject)
        );

        res.status(201).json(volume);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async cloneVolume(req, res) {
        const volume = await Volume.clone(
            Number(req.params.idVolume),
            req.session.user.id,
            Number(req.params.idProject)
        );
        res.status(201).json(volume);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async removeFromProject(req, res) {
        await Volume.removeFromProject(
            Number(req.params.idVolume),
            Number(req.params.idProject)
        );

        res.sendStatus(204);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async addAnnotations(req, res) {
        if (!req.body) {
            throw new ApiError(400, "No annotations file found.");
        }
        
        const annotations = req.body;

        if (!Array.isArray(annotations)) {
            throw new ApiError(400, "Unknown annotations format.");
        }

        const sparseLabel = await Volume.addAnnotations(
            Number(req.params.idVolume),
            Number(req.session.user.id),
            annotations
        );

        res.json(sparseLabel);
    }
}
