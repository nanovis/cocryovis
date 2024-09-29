// @ts-check

import Model from "../models/model.mjs";

export default class ModelController {
    static async createModel(req, res) {
        const model = await Model.create(
            req.body.name,
            req.body.description,
            Number(req.session.user.id),
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
