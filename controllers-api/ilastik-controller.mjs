// @ts-check

import Volume from "../models/volume.mjs";
import IlastikHandler from "../tools/ilastik-handler.mjs";
import User from "../models/user.mjs";

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
     * @param {IlastikHandler} illastik
     */
    static async getIlastikTaskQueue(illastik, req, res) {
        const taskQueueIdentifiers = illastik.queuedIdentifiers;

        const users = await User.getByIds(
            taskQueueIdentifiers.map((i) => i.userId)
        );
        const volumes = await Volume.getByIds(
            taskQueueIdentifiers.map((i) => i.volumeId)
        );

        const result = users.map(function (u, i) {
            return {
                userId: u.id,
                username: u.username,
                volumeName: volumes[i].name,
                volumeId: volumes[i].id,
            };
        });

        return res.json(result);
    }

    /**
     * @param {IlastikHandler} illastik
     */
    static async getIlastikUserTaskHistory(illastik, req, res) {
        const userTaskHistory = illastik.taskHistory.filter(
            (t) => t.userId === req.session.user.id
        );

        const volumes = await Volume.getByIds(
            userTaskHistory.map((i) => i.volumeId)
        );

        const result = userTaskHistory.map(function (t, i) {
            return {
                volumeName: volumes[i].name,
                volumeId: volumes[i].id,
                taskStatus: t.taskStatus,
                logFile: t.logFile.fileName,
            };
        });

        return res.json(result);
    }
}
