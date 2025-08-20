// @ts-check

import z from "zod";
import { idResult, resultSchema } from "./componentSchemas/result-schema.mjs";
import { defaultError, generateErrors } from "./error-path-schema.mjs";
import { idVolume } from "./componentSchemas/volume-schema.mjs";
import { checkpointSchema } from "./componentSchemas/checkpoint-schema.mjs";
import {
    multipleFileSchema,
    singleFileSchema,
} from "./componentSchemas/file-schema.mjs";
import { idSchema } from "./componentSchemas/id-param-schema.mjs";

export const idVolumeAndIdResultParams = z
    .object({
        idVolume: idSchema,
        idResult: idSchema,
    })
    .meta({
        param: [
            {
                name: "idVolume",
                in: "path",
                required: true,
                example: "1",
            },
            {
                name: "idResult",
                in: "path",
                required: true,
                example: "1",
            },
        ],
    });

export const resultFilesSchema = z.object({
    id: z.number(),
    name: z.string(),
    rawFileName: z.string(),
    settingsFileName: z.string(),
    index: z.number(),
    resultId: z.number(),
});

export const getResultSchema = z.array(
    resultSchema.extend({
        checkpoints: checkpointSchema,
    })
);

/**
 * @type import("zod-openapi").ZodOpenApiPathsObject
 */
export const resultPath = {
    "/result/{idResult}": {
        get: {
            requestParams: {
                path: idResult,
            },
            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: resultSchema,
                        },
                    },
                },
                ...defaultError,
            },
        },
    },
    "/result/{idResult}/details": {
        get: {
            requestParams: {
                path: idResult,
            },
            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: resultSchema,
                        },
                    },
                },
                ...defaultError,
            },
        },
    },
    "/volume/{idVolume}/results": {
        get: {
            requestParams: {
                path: idVolume,
            },
            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: getResultSchema,
                        },
                    },
                },
                ...defaultError,
            },
        },

        post: {
            requestParams: {
                path: idVolume,
            },
            requestBody: {
                content: {
                    "multipart/form-data": {
                        schema: multipleFileSchema,
                    },
                },
            },
            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: resultFilesSchema,
                        },
                    },
                },
                ...defaultError,
            },
        },
    },
    "/volume/{idVolume}/result/{idResult}": {
        delete: {
            requestParams: {
                path: idVolumeAndIdResultParams,
            },
            responses: {
                204: {},
                ...defaultError,
            },
        },
    },
    "/result/{idResult}/data": {
        get: {
            requestParams: {
                path: idResult,
            },
            responses: {
                200: {
                    content: {
                        "application/zip": {
                            schema: singleFileSchema,
                        },
                    },
                },
                ...defaultError,
                ...generateErrors([400]),
            },
        },
    },
};
