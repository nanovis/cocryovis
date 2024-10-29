// @ts-check

import Model from "../models/model.mjs";

export default class ModelController {
    static async getModel(req, res) {
        const options = this.#parseOptionQuery(req);
        const model = await Model.getById(Number(req.params.idModel), options);

        return res.status(200).json(model);
    }

    static async getModelsFromProject(req, res) {
        const options = ModelController.#parseOptionQuery(req);
        const models = await Model.getModelsFromProject(
            Number(req.params.idProject),
            options
        );

        return res.status(200).json(models);
    }

    /**
     * @returns {import("../models/model.mjs").Options}
     */
    static #parseOptionQuery(req) {
        return {
            checkpoints: !!req?.query?.checkpoints,
            projects: !!req?.query?.projects,
        };
    }

    static async createModel(req, res) {
        const model = await Model.create(
            req.body.name,
            req.body.description,
            Number(req.session.user.id),
            Number(req.params.idProject)
        );

        return res.status(201).json(model);
    }

    static async cloneModel(req, res) {
        const model = await Model.clone(
            Number(req.params.idModel),
            req.session.user.id,
            Number(req.params.idProject)
        );
        return res.status(201).json(model);
    }

    static async removeModel(req, res) {
        await Model.del(req.params.idModel);
        return res.sendStatus(204);
    }

    static async removeFromProject(req, res) {
        await Model.removeFromProject(
            Number(req.params.idModel),
            Number(req.params.idProject)
        );
        return res.sendStatus(204);
    }
}
