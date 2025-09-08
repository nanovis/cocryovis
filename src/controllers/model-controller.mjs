// @ts-check

import Model from "../models/model.mjs";
import { idProject } from "#schemas/componentSchemas/project-schema.mjs";
import {
    createModelSchema,
    getModelQuerySchema,
    idModelAndidProject,
} from "#schemas/models-path-schema.mjs";
import validateSchema from "../tools/validate-schema.mjs";
import { idModel } from "#schemas/componentSchemas/model-schema.mjs";

/**
 * @typedef { import("express").Request } Request
 * @typedef { import("express").Response } Response
 */
export default class ModelController {
    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async getModel(req, res) {
        const { params, query } = validateSchema(req, {
            paramsSchema: idModel,
            querySchema: getModelQuerySchema,
        });

        const model = await Model.getById(params.idModel, query);

        res.status(200).json(model);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async getModelsFromProject(req, res) {
        const { params, query } = validateSchema(req, {
            paramsSchema: idProject,
            querySchema: getModelQuerySchema,
        });

        const models = await Model.getModelsFromProject(
            params.idProject,
            query
        );

        res.status(200).json(models);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async createModel(req, res) {
        const { params, body } = validateSchema(req, {
            paramsSchema: idProject,
            bodySchema: createModelSchema,
        });

        const model = await Model.create(
            body.name,
            body.description,
            Number(req.session.user.id),
            params.idProject
        );

        res.status(201).json(model);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async cloneModel(req, res) {
        const { params } = validateSchema(req, {
            paramsSchema: idModelAndidProject,
        });

        const model = await Model.clone(
            params.idModel,
            req.session.user.id,
            params.idProject
        );

        res.status(201).json(model);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async deleteModel(req, res) {
        const { params } = validateSchema(req, {
            paramsSchema: idModel,
        });

        await Model.del(params.idModel);

        res.sendStatus(204);
    }
}
