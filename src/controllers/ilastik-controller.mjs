// @ts-check

import { idVolume } from "#schemas/componentSchemas/volume-schema.mjs";
import validateSchema from "../tools/validate-schema.mjs";
import IlastikHandler from "../tools/ilastik-handler.mjs";

/**
 * @typedef { import("express").Request } Request
 * @typedef { import("express").Response } Response
 */
export default class IlastikController {
    /**
     * @param {IlastikHandler} ilastik
     * @param {Request} req
     * @param {Response} res
     */
    static async queuePseudoLabelsGeneration(ilastik, req, res) {
        const { params } = validateSchema(req, { paramsSchema: idVolume });

        await ilastik.queueLabelGeneration(
            params.idVolume,
            Number(req.session.user.id)
        );

        res.sendStatus(201);
    }
}
