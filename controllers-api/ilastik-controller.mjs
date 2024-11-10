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

    /**
     * @param {IlastikHandler} ilastik
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async getIlastikTaskQueue(ilastik, req, res) {
        const taskQueue = ilastik.getTaskQueue();

        res.json(taskQueue);
    }

    /**
     * @param {IlastikHandler} ilastik
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async getIlastikUserTaskHistory(ilastik, req, res) {
        const taskHistory = ilastik.taskHistory.getUserTaskHistory(
            req.session.user.id
        );

        res.json(taskHistory);
    }
}
