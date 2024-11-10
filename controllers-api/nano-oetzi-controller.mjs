// @ts-check

import NanoOetziHandler from "../tools/nano-oetzi-handler.mjs";
import Utils from "../tools/utils.mjs";

export default class NanoOetziController {
    /**
     * @param {NanoOetziHandler} nanoOetzi
     */
    static async getNanoOetziTaskQueue(nanoOetzi, req, res) {
        const taskQueue = nanoOetzi.getTaskQueue();

        return res.json(taskQueue);
    }

    /**
     * @param {NanoOetziHandler} nanoOetzi
     */
    static async getNanoOetziUserTaskHistory(nanoOetzi, req, res) {
        const taskHistory = nanoOetzi.taskHistory.getUserTaskHistory(
            req.session.user.id
        );

        return res.json(taskHistory);
    }

    /**
     * @param {NanoOetziHandler} nanoOetzi
     */
    static async queueInference(nanoOetzi, req, res) {
        const checkpointId = Number(req.body.checkpointId);
        const volumeId = Number(req.body.volumeId);

        await nanoOetzi.queueInference(
            checkpointId,
            volumeId,
            Number(req.session.user.id)
        );

        return res.sendStatus(204);
    }

    /**
     * @param {NanoOetziHandler} nanoOetzi
     */
    static async queueTraining(nanoOetzi, req, res) {
        const trainingVolumesIds = Utils.parseStringArray(
            req.body.trainingVolumes
        );
        const validationVolumesIds = Utils.parseStringArray(
            req.body.validationVolumes
        );
        const testingVolumesIds = Utils.parseStringArray(
            req.body.testingVolumes
        );

        await nanoOetzi.queueTraining(
            Number(req.body.modelId),
            Number(req.session.user.id),
            trainingVolumesIds,
            validationVolumesIds,
            testingVolumesIds
        );

        return res.sendStatus(204);
    }
}
