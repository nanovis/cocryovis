// @ts-check

import z from "zod";
import { defaultError } from "./error-path-schema.mjs";
import {
    idProject,
    projectSchema,
} from "./componentSchemas/project-schema.mjs";
import { idModel, modelSchema } from "./componentSchemas/model-schema.mjs";
import { checkpointSchema } from "./componentSchemas/checkpoint-schema.mjs";
import { typeSchema } from "./componentSchemas/volume-data-schema.mjs";
import { idSchema } from "./componentSchemas/id-param-schema.mjs";

export const getModelQuerySchema = z.object({
    checkpoints: z.coerce.boolean().optional(),
    projects: z.coerce.boolean().optional(),
});

export const getModelsSchema = z.array(
    modelSchema.extend({
        checkpoints: z.array(checkpointSchema).optional(),
        projects: z.array(projectSchema).optional(),
    })
);

export const createModelSchema = z.object({
    name: z.string(),
    description: z.string(),
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
        idProject: idSchema,
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
                name: "Project",
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
                        schema: createModelSchema,
                    },
                },
            },
            responses: {
                201: {
                    content: {
                        "application/json": {
                            schema: modelSchema,
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
                            schema: createModelSchema,
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
    "/project/{idProject}/model/{idModel}params": {
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
