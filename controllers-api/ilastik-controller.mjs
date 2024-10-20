// @ts-check

import IlastikHandler from "../tools/ilastik-handler.mjs";

export default class IlastikController {
    /**
     * @param {IlastikHandler} illastik
     */
    static async queuePseudoLabelsGeneration(illastik, req, res) {
        await illastik.queueLabelGeneration(
            Number(req.params.idVolume),
            Number(req.session.user.id)
        );

        return res.sendStatus(201);
    }

    /**
     * @param {IlastikHandler} ilastik
     */
    static async getIlastikTaskQueue(ilastik, req, res) {
        const taskQueue = ilastik.getTaskQueue();

        return res.json(taskQueue);
    }

    /**
     * @param {IlastikHandler} ilastik
     */
    static async getIlastikUserTaskHistory(ilastik, req, res) {
        const taskHistory = ilastik.getUserTaskHistory(req.session.user.id);

        return res.json(taskHistory);
    }
}
