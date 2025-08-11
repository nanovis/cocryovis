// @ts-check

import z from "zod";
import { idCheckpoint } from "./componentSchemas/idCheckpointSchema.mjs";
import { defaultError, generateErrors } from "./errorSchema.mjs";
import {
    checkpointSchema,
    checkpointSchemaArray,
} from "./componentSchemas/checkpointSchema.mjs";
import { idSchema } from "./componentSchemas/idParamSchema.mjs";
import { idModel } from "./componentSchemas/idModelSchema.mjs";
import {
    multipleFileSchema,
    singleFileSchema,
} from "./componentSchemas/fileSchema.mjs";

export const idModelAndidcheckpointParam = z
    .object({
        idcheckpoint: idSchema,
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
    },
    "/model/{idModel}/checkpoint/{idCheckpoint}": {
        delete: {
            requestParams: {
                path: idModelAndidcheckpointParam,
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
                            schema: checkpointSchema,
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
                        "application/json": {
                            schema: checkpointTxt,
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
                        "application/json": {
                            schema: checkpointTxt,
                        },
                    },
                },
                ...defaultError,
                ...generateErrors([400]),
            },
        },
    },
};
