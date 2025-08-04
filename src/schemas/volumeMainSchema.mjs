// @ts-check

import z from "zod";

import { idProject } from "./componentSchemas/idProjectParamSchema.mjs";
import { rawVolumeDataSchema } from "./componentSchemas/rawVolumeDataSchema.mjs";
import { sparseLabelVolumeDataSchema } from "./componentSchemas/sparseLabelVolumeDataSchema.mjs";
import { pseudoLabelVolumeDataSchema } from "./componentSchemas/pseudoLabelVolumeDataSchema.mjs";
import { resultSchemaWithCheckpoint } from "./componentSchemas/resultSchema.mjs";
import { defaultError } from "./errorSchema.mjs";
import { projectSchema } from "./componentSchemas/ProjectSchema.mjs";

export const volumeSchema = z.object({
    id: z.number(),
    name: z.string(),
    description: z.string(),
    creatorId: z.number().nullable(),
    rawDataId: z.number().nullable(),
});

export const volumeQuerySchema = z.object({
    rawData: z.boolean().optional(),
    sparseVolumes: z.boolean().optional(),
    pseudoVolumes: z.boolean().optional(),
    results: z.boolean().optional(),
    projects: z.boolean().optional(),
});

export const deepVolumeSchema = volumeSchema.extend({
    rawData: rawVolumeDataSchema.nullable(),
    sparseVolumes: z.array(sparseLabelVolumeDataSchema),
    pseudoVolumes: z.array(pseudoLabelVolumeDataSchema),
    results: z.array(resultSchemaWithCheckpoint),
});

const createVolumeReq = z.object({
    name: z.string(),
    description: z.string(),
});

export const getVolumeSchema = volumeSchema.extend({
    rawData: rawVolumeDataSchema.nullable(),
    sparseVolumes: z.array(sparseLabelVolumeDataSchema),
    pseudoVolumes: z.array(pseudoLabelVolumeDataSchema),
    results: z.array(resultSchemaWithCheckpoint),
    projects: z.array(projectSchema),
});

/**
 * @type import("zod-openapi").ZodOpenApiPathsObject
 */
export const volumePath = {
    "/project/{idProject}/volumes/deep": {
        get: {
            requestParams: {
                path: idProject,
            },
            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: deepVolumeSchema,
                        },
                    },
                },
                ...defaultError,
            },
        },
    },
    "/project/{idProject}/volumes": {
        post: {
            requestParams: {
                path: idProject,
            },
            requestBody: {
                content: {
                    "application/json": {
                        schema: createVolumeReq,
                    },
                },
            },
            responses: {
                201: {
                    content: {
                        "application/json": {
                            schema: volumeSchema,
                        },
                    },
                },
                ...defaultError,
            },
        },
    },
    "/volume/{idVolume}": {
        get: {
            requestParams: {
                path: idProject,
                query: volumeQuerySchema,
            },
            responses: {
                201: {
                    content: {
                        "application/json": {
                            schema: getVolumeSchema,
                        },
                    },
                },
                ...defaultError,
            },
        },
    },
    "/project/{idProject}/volume/{idVolume}": {
        get: {
            requestParams: {
                path: idProject,
                query: volumeQuerySchema,
            },
            responses: {
                201: {
                    content: {
                        "application/json": {
                            schema: getVolumeSchema,
                        },
                    },
                },
                ...defaultError,
            },
        },
    },
};
