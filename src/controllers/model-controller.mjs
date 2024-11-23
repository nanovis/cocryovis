// @ts-check

import Model from "../models/model.mjs";

export default class ModelController {
    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async getModel(req, res) {
        const options = this.#parseOptionQuery(req);
        const model = await Model.getById(Number(req.params.idModel), options);

        res.status(200).json(model);
    }

    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async getModelsFromProject(req, res) {
        const options = ModelController.#parseOptionQuery(req);
        const models = await Model.getModelsFromProject(
            Number(req.params.idProject),
            options
        );

        res.status(200).json(models);
    }

    /**
     * @param {AuthenticatedRequest} req
     * @returns {import("../models/model.mjs").Options}
     */
    static #parseOptionQuery(req) {
        return {
            checkpoints: !!req?.query?.checkpoints,
            projects: !!req?.query?.projects,
        };
    }

    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async createModel(req, res) {
        const model = await Model.create(
            req.body.name,
            req.body.description,
            Number(req.session.user.id),
            Number(req.params.idProject)
        );

        res.status(201).json(model);
    }

    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async cloneModel(req, res) {
        const model = await Model.clone(
            Number(req.params.idModel),
            req.session.user.id,
            Number(req.params.idProject)
        );

        res.status(201).json(model);
    }

    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async removeFromProject(req, res) {
        const projectId = Number(req.params.idProject);

        const model = await Model.removeFromProject(
            Number(req.params.idModel),
            projectId
        );

        res.sendStatus(204);
    }
}
