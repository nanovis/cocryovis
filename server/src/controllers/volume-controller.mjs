// @ts-check

import Volume from "../models/volume.mjs";
import { annotationsSchema } from "@cocryovis/schemas/volume-path-schema";
import { idProject } from "../../../schemas/dist/componentSchemas/project-schema.js";
import {
    idVolume,
    volumeUpdateSchema,
} from "../../../schemas/dist/componentSchemas/volume-schema.js";
import validateSchema from "../tools/validate-schema.mjs";
import {
    createVolumeReq,
    volumeQuerySchema,
} from "@cocryovis/schemas/volume-path-schema";

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
    // static async cloneVolume(req, res) {
    //     const volume = await Volume.clone(
    //         Number(req.params.idVolume),
    //         req.session.user.id,
    //         Number(req.params.idProject)
    //     );
    //     res.status(201).json(volume);
    // }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async deleteVolume(req, res) {
        const { params } = validateSchema(req, {
            paramsSchema: idVolume,
        });

        await Volume.del(params.idVolume);

        res.sendStatus(204);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async update(req, res) {
        const { params, body } = validateSchema(req, {
            paramsSchema: idVolume,
            bodySchema: volumeUpdateSchema,
        });

        const volume = await Volume.update(params.idVolume, body);
        res.status(201).json(volume);
    }
}
