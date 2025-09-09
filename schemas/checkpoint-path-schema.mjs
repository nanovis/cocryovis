// @ts-check

import z from "zod";
import { defaultError, generateErrors } from "./error-path-schema.mjs";
import {
    checkpointSchema,
    checkpointSchemaArray,
    idCheckpoint,
} from "./componentSchemas/checkpoint-schema.mjs";
import { idSchema } from "./componentSchemas/id-param-schema.mjs";
import {
    multipleFileSchema,
    singleFileSchema,
} from "./componentSchemas/file-schema.mjs";
import { idModel } from "./componentSchemas/model-schema.mjs";

export const idModelAndidcheckpointParam = z
    .object({
        idCheckpoint: idSchema,
        idModel: idSchema,
    })
    .meta({
        param: [
            {
                name: "idcheckpoint",
                in: "path",
                required: true,
                example: "1",
            },
            {
                name: "idModel",
                in: "path",
                required: true,
                example: "1",
            },
        ],
    });

export const checkpointTxt = z.object({
    checkpointTxt: z.string(),
});

/**
 * @type import("zod-openapi").ZodOpenApiPathsObject
 */
export const checkPointPath = {
    "/checkpoint/{idCheckpoint}": {
        get: {
            requestParams: {
                path: idCheckpoint,
            },

            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: checkpointSchema,
                        },
                    },
                },
                ...defaultError,
            },
        },

        delete: {
            requestParams: {
                path: idCheckpoint,
            },
            responses: {
                204: {},
                ...defaultError,
            },
        },
    },
    "/model/{idModel}/checkpoints": {
        get: {
            requestParams: {
                path: idModel,
            },

            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: checkpointSchemaArray,
                        },
                    },
                },
                ...defaultError,
            },
        },
        post: {
            requestParams: {
                path: idModel,
            },
            requestBody: {
                content: {
                    "multipart/form-data": {
                        schema: multipleFileSchema,
                    },
                },
            },
            responses: {
                201: {
                    content: {
                        "application/json": {
                            schema: checkpointSchemaArray,
                        },
                    },
                },
                ...defaultError,
            },
        },
    },
    "/checkpoint/{idCheckpoint}/download": {
        get: {
            requestParams: {
                path: idCheckpoint,
            },
            requestBody: {
                content: {
                    "multipart/form-data": {
                        schema: multipleFileSchema,
                    },
                },
            },

            responses: {
                201: {
                    content: {
                        "application/zip": {
                            schema: singleFileSchema,
                        },
                    },
                },
                ...defaultError,
            },
        },
    },
    "/checkpoint/{idCheckpoint}/as-text": {
        get: {
            requestParams: {
                path: idCheckpoint,
            },

            responses: {
                200: {
                    content: {
                        "text/plain": {
                            schema: z.string(),
                        },
                    },
                },
                ...defaultError,
                ...generateErrors([400]),
            },
        },
    },
    "/checkpoint/to-text": {
        post: {
            requestBody: {
                content: {
                    "multipart/form-data": {
                        schema: singleFileSchema,
                    },
                },
            },
            responses: {
                200: {
                    content: {
                        "text/plain": {
                            schema: z.string(),
                        },
                    },
                },
                ...defaultError,
                ...generateErrors([400]),
            },
        },
    },
};
