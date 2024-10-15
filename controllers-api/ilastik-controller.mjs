// @ts-check

import Volume from "../models/volume.mjs";
import IlastikHandler from "../tools/ilastik-handler.mjs";
import User from "../models/user.mjs";
import Utils from "../tools/utils.mjs";

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
        const usersMap = Utils.arrayToMap(users, "id");

        const volumes = await Volume.getByIds(
            taskQueueIdentifiers.map((i) => i.volumeId)
        );
        const volumeMap = Utils.arrayToMap(volumes, "id");

        const result = taskQueueIdentifiers.map(function (t) {
            const user = usersMap.get(t.userId);
            const volume = volumeMap.get(t.volumeId);
            return {
                userId: user.id,
                username: user.username,
                volumeName: volume.name,
                volumeId: volume.id,
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
        const volumeMap = Utils.arrayToMap(volumes, "id");

        const result = userTaskHistory.map(function (t) {
            const volume = volumeMap.get(t.volumeId);
            return {
                volumeName: volume.name,
                volumeId: volume.id,
                taskStatus: t.taskStatus,
                logFile: t.logFile.fileName,
            };
        });

        return res.json(result.reverse());
    }
}
