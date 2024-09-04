// @ts-check

import { Model } from "../models/model.mjs";

export class ModelController {
    static async createModel(req, res) {
        console.log("Creating a new model");
        try {
            await Model.create(
                req.body.name,
                req.body.description,
                Number(req.session.user.id),
                Number(req.params.idProject)
            );

            console.log("Model successfully created.");
            res.redirect(
                `/api/actions/projects/details/${req.params.idProject}`
            );
        } catch (err) {
            console.error("Error in creating model:", err);
            res.status(500).send(err);
        }
    }

    static async removeModel(req, res) {
        console.log(`Deleting Model ${req.params.idModel}`);
        try {
            await Model.del(req.params.idModel);
            res.redirect(
                `/api/actions/projects/details/${req.params.idProject}`
            );
        } catch (err) {
            console.error("Error in creating model:", err);
            res.status(500).send(err);
        }
    }

    static async removeFromProject(req, res) {
        try {
            await Model.removeFromProject(
                Number(req.params.idModel),
                Number(req.params.idProject)
            );
            res.redirect(
                `/api/actions/projects/details/` + req.params.idProject
            );
        } catch (err) {
            res.status(500).send(err);
        }
    }
}
