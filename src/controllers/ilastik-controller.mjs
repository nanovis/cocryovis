// @ts-check

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
        await ilastik.queueLabelGeneration(
            Number(req.params.idVolume),
            Number(req.session.user.id)
        );

        res.sendStatus(201);
    }
}
