// @ts-check

import Volume from "../models/volume.mjs";
import { annotationsSchema } from "#schemas/volume-path-schema.mjs";
import { idProject } from "#schemas/componentSchemas/project-schema.mjs";
import { idVolume } from "#schemas/componentSchemas/volume-schema.mjs";
import validateSchema from "../tools/validate-schema.mjs";
import {
    createVolumeReq,
    idProjectAndVolume,
    volumeQuerySchema,
} from "#schemas/volume-path-schema.mjs";

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
        const { query, params } = validateSchema(req, {
            querySchema: volumeQuerySchema,
            paramsSchema: idVolume,
        });
        const volume = await Volume.getById(params.idVolume, query);

        res.status(200).json(volume);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    // static async getVolumesFromProject(req, res) {
    //     const options = VolumeController.#parseOptionQuery(req);
    //     const volumes = await Volume.getVolumesFromProject(
    //         Number(req.params.idProject),
    //         options
    //     );

    //     res.status(200).json(volumes);
    // }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async getVolumesFromProjectDeep(req, res) {
        const { params } = validateSchema(req, { paramsSchema: idProject });

        const volumes = await Volume.getVolumesFromProjectDeep(
            params.idProject
        );

        res.status(200).json(volumes);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async createVolume(req, res) {
        const { body, params } = validateSchema(req, {
            bodySchema: createVolumeReq,
            paramsSchema: idProject,
        });

        const volume = await Volume.create(
            body.name,
            body.description,
            req.session.user.id,
            params.idProject
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
        const { params } = validateSchema(req, {
            paramsSchema: idProjectAndVolume,
        });

        await Volume.removeFromProject(params.idVolume, params.idProject);

        res.sendStatus(204);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async addAnnotations(req, res) {
        const { params, body } = validateSchema(req, {
            paramsSchema: idVolume,
            bodySchema: annotationsSchema,
        });

        const sparseLabel = await Volume.addAnnotations(
            params.idVolume,
            Number(req.session.user.id),
            body
        );

        res.json(sparseLabel);
    }
}
