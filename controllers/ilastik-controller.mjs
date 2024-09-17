// @ts-check

import Volume from "../models/volume.mjs";
import IlastikHandler from "../tools/ilastik-handler.mjs";
import User from "../models/user.mjs";

export default class IlastikController {
    /**
     * @param {IlastikHandler} illastik
     */
    static async getIlastikTaskQueue(illastik, req, res) {
        try {
            const taskQueueIdentifiers = illastik.queuedIdentifiers;

            const users = await User.getByIds(
                taskQueueIdentifiers.map((i) => i.userId)
            );
            const volumes = await Volume.getByIds(
                taskQueueIdentifiers.map((i) => i.volumeId)
            );

            const result = users.map(function (u, i) {
                return {
                    username: u.username,
                    volumeName: volumes[i].name,
                    volumeId: volumes[i].id,
                };
            });

            res.setHeader("Content-Type", "application/json");
            res.json(result);
        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }
    }

    /**
     * @param {IlastikHandler} illastik
     */
    static async getIlastikUserTaskHistory(illastik, req, res) {
        try {
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
                    logFileName: t.logFile.fileName,
                };
            });

            res.setHeader("Content-Type", "application/json");
            res.json(result);
        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }
    }
}
