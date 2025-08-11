// @ts-check

import z from "zod";
import { defaultError } from "./errorSchema.mjs";
import { idProject, projectSchema } from "./componentSchemas/projectSchema.mjs";
import { modelSchema } from "./componentSchemas/modelSchema.mjs";
import { checkpointSchema } from "./componentSchemas/checkpointSchema.mjs";
import { typeSchema } from "./componentSchemas/idVolumeDataSchema.mjs";
import { idSchema } from "./componentSchemas/idParamSchema.mjs";
import { idModel } from "./componentSchemas/idModelSchema.mjs";

export const getModelQuerySchema = z.object({
    checkpoints: z.boolean().optional(),
    projects: z.boolean().optional(),
});

export const getModelsSchema = modelSchema.extend({
    checkpoints: z.array(checkpointSchema).optional(),
    projects: z.array(projectSchema).optional(),
});

export const createModelSchemaReq = z.object({
    name: z.string(),
    description: z.string(),
});

export const CreateModelSchemaRes = modelSchema.omit({
    checkpoints: true,
});

export const idModelAndTypeSchema = z
    .object({
        idModel: idSchema,
        type: typeSchema,
    })
    .meta({
        param: [
            {
                name: "idModel",
                in: "path",
                required: true,
                example: "1",
            },
            {
                name: "type",
                in: "path",
                required: true,
                example: "RawVolumeData",
            },
        ],
    });

export const idModelAndidProject = z
    .object({
        idModel: idSchema,
        idSchema: idSchema,
    })
    .meta({
        param: [
            {
                name: "idModel",
                in: "path",
                required: true,
                example: "1",
            },
            {
                name: "idSchema",
                in: "path",
                required: true,
                example: "1",
            },
        ],
    });

/**
 * @type import("zod-openapi").ZodOpenApiPathsObject
 */
export const modelsPath = {
    "/project/{idProject}/models": {
        get: {
            requestParams: {
                path: idProject,
                query: getModelQuerySchema,
            },

            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: getModelsSchema,
                        },
                    },
                },
                ...defaultError,
            },
        },

        post: {
            requestParams: {
                path: idProject,
            },
            requestBody: {
                content: {
                    "application/json": {
                        schema: createModelSchemaReq,
                    },
                },
            },
            responses: {
                201: {
                    content: {
                        "application/json": {
                            schema: createModelSchemaReq,
                        },
                    },
                },
                ...defaultError,
            },
        },
    },
    "/project/{idProject}/model/{idModel}/clone": {
        post: {
            requestParams: {
                path: idModelAndTypeSchema,
            },

            responses: {
                201: {
                    content: {
                        "application/json": {
                            schema: createModelSchemaReq,
                        },
                    },
                },
                ...defaultError,
            },
        },
    },
    "/model/{idModel}": {
        get: {
            requestParams: {
                path: idModel,
                query: getModelQuerySchema,
            },

            responses: {
                201: {
                    content: {
                        "application/json": {
                            schema: getModelsSchema,
                        },
                    },
                },
                ...defaultError,
            },
        },
    },
    "/project/{idProject}/model/{idModel": {
        delete: {
            requestParams: {
                path: idModelAndidProject,
            },

            responses: {
                204: {},
                ...defaultError,
            },
        },
    },
};
