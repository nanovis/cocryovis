// @ts-check

import z from "zod";

import { rawVolumeDataSchema } from "./componentSchemas/rawVolumeDataSchema.mjs";
import { sparseLabelVolumeDataSchema } from "./componentSchemas/sparseLabelVolumeDataSchema.mjs";
import { pseudoLabelVolumeDataSchema } from "./componentSchemas/pseudoLabelVolumeDataSchema.mjs";
import { resultSchemaWithCheckpoint } from "./componentSchemas/resultSchema.mjs";
import { defaultError } from "./errorSchema.mjs";
import { idVolume, volumeSchema } from "./componentSchemas/volumeSchema.mjs";
import { idProject, projectSchema } from "./componentSchemas/projectSchema.mjs";
import { idSchema } from "./componentSchemas/idParamSchema.mjs";

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

export const createVolumeReq = z.object({
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

export const idProjectAndVolume = z
    .object({
        idProject: idSchema,
        idVolume: idSchema,
    })
    .meta({
        param: {
            name: "idProject,idVolume",
            in: "path",
            required: true,
        },
        example: { idProject: "1", idVolume: "1" },
    });

export const xyz = z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
});
export const annotationsEntry = z.object({
    add: z.boolean(),
    dimensions: xyz,
    kernelSize: xyz,
    positions: z.array(xyz),
    volumeName: z.string(),
});

export const annotations = z.array(annotationsEntry);

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
                path: idVolume,
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
        delete: {
            requestParams: {
                path: idProjectAndVolume,
            },
            responses: {
                204: {},
                ...defaultError,
            },
        },
    },
    "/volume/{idVolume}/add-annotations": {
        put: {
            requestParams: {
                path: idVolume,
            },
            requestBody: {
                content: {
                    "application/json": {
                        schema: annotations,
                    },
                },
            },
            responses: {
                201: {
                    content: {
                        "application/json": {
                            schema: sparseLabelVolumeDataSchema,
                        },
                    },
                },
                ...defaultError,
            },
        },
    },
};
