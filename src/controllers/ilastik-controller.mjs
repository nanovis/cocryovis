// @ts-check

import IlastikHandler from "../tools/ilastik-handler.mjs";

export default class IlastikController {
    /**
     * @param {IlastikHandler} ilastik
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async queuePseudoLabelsGeneration(ilastik, req, res) {
        await ilastik.queueLabelGeneration(
            Number(req.params.idVolume),
            Number(req.session.user.id)
        );

        res.sendStatus(201);
    }
}
