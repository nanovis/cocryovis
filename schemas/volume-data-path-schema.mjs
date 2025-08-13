// @ts-check

import z from "zod";
import { idSchema } from "./componentSchemas/id-param-schema.mjs";
import { typeSchema } from "./componentSchemas/volume-data-schema.mjs";
import { defaultError } from "./error-path-schema.mjs";
import {
    sparseLabelVolumeDataSchema,
    sparseLabelVolumeDataUpdateSchema,
} from "./componentSchemas/sparse-label-volume-data-schema.mjs";
import {
    pseudoLabelVolumeDataSchema,
    pseudoLabelVolumeDataUpdateSchema,
} from "./componentSchemas/pseudo-label-volume-data-schema.mjs";
import {
    rawVolumeDataSchema,
    rawVolumeDataUpdateSchema,
} from "./componentSchemas/raw-volume-data-schema.mjs";
import {
    multipleFileSchema,
    singleFileSchema,
} from "./componentSchemas/file-schema.mjs";
import { annotationsSchema } from "./volume-path-schema.mjs";
import { volumeSettings } from "./componentSchemas/volume-settings-schema.mjs";

export const volumeData = z.union([
    sparseLabelVolumeDataSchema,
    pseudoLabelVolumeDataSchema,
    rawVolumeDataSchema,
]);

export const volumeDataUpdate = z.union([
    sparseLabelVolumeDataUpdateSchema,
    pseudoLabelVolumeDataUpdateSchema,
    rawVolumeDataUpdateSchema,
]);

// export const fileType = z.object({ type: z.enum(["mrc", "raw"]) });

// export const url = z.url({
//   protocol: /^https?$/,
// });

export const fromUrlSchema = z
    .object({
        fileType: z.enum(["mrc", "raw"]),
        url: z.url({
            protocol: /^https?$/,
        }),
        volumeSettings: volumeSettings.optional(),
    })
    .refine((f) => f.fileType !== "raw" || f.volumeSettings, {
        message: "Raw files require volume settings.",
    });

export const updateAnnotations = z.object({
    annotation: annotationsSchema,
    saveAsNew: z.boolean().default(false),
});

export const cryoetUrl = z.object({
    metadata: z.url(),
});

export const idVolumeAndType = z
    .object({
        idVolume: idSchema,
        type: typeSchema,
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
                name: "type",
                in: "path",
                required: true,
                example: "RawVolumeData",
            },
        ],
    });

export const idVolumeDataAndType = z
    .object({
        idVolumeData: idSchema,
        type: typeSchema,
    })
    .meta({
        param: [
            {
                name: "idVolumeData",
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

export const idTomogram = z
    .object({
        idTomogram: idSchema,
    })
    .meta({
        param: {
            name: "idTomogram",
            in: "path",
            required: true,
        },
        example: { idVolume: "1" },
    });

export const idVolumeVolumeDataTypeParams = z
    .object({
        idVolumeData: idSchema,
        type: typeSchema,
        idVolume: idSchema,
    })
    .meta({
        param: [
            {
                name: "idVolumeData",
                in: "path",
                required: true,
                example: "1",
            },
            {
                name: "type",
                in: "path",
                required: true,
            },
            {
                name: "idVolume",
                in: "path",
                required: true,
            },
        ],
    });

/**
 * @type import("zod-openapi").ZodOpenApiPathsObject
 */
export const volumeDataPath = {
    "/volumeData/{type}/{idVolumeData}": {
        get: {
            requestParams: {
                path: idVolumeDataAndType,
            },
            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: volumeData,
                        },
                    },
                },
                ...defaultError,
            },
        },
        put: {
            requestParams: {
                path: idVolumeDataAndType,
            },
            responses: {
                200: {
                    content: {
                        "application/octet-stream": {},
                    },
                },
                ...defaultError,
            },
        },
    },
    "/volumeData/{type}/{idVolumeData}/data": {
        get: {
            requestParams: {
                path: idVolumeDataAndType,
            },
            requestBody: {
                content: {
                    "application/json": {
                        schema: volumeDataUpdate,
                    },
                },
            },
            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: volumeData,
                        },
                    },
                },
                ...defaultError,
            },
        },
    },
    "/volumeData/{type}/{idVolumeData}/visualization-data": {
        get: {
            requestParams: {
                path: idVolumeDataAndType,
            },
            responses: {
                200: {
                    content: {
                        "application/octet-stream": {},
                    },
                },
                ...defaultError,
            },
        },
    },
    "/volume/{idVolume}/volumeData/:type/from-files": {
        post: {
            requestParams: {
                path: idVolumeAndType,
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
                            schema: volumeData,
                        },
                    },
                },
                ...defaultError,
            },
        },
    },
    "/volume/{idVolume}/volumeData/{type}/from-mrc-file": {
        post: {
            requestParams: {
                path: idVolumeAndType,
            },
            requestBody: {
                content: {
                    "multipart/form-data": {
                        schema: singleFileSchema,
                    },
                },
            },
            responses: {
                201: {
                    content: {
                        "application/json": {
                            schema: rawVolumeDataSchema,
                        },
                    },
                },
                ...defaultError,
            },
        },
    },
    "/volume/{idVolume}/volumeData/{type}/from-url": {
        post: {
            requestParams: {
                path: idVolumeAndType,
            },
            requestBody: {
                content: {
                    "application/json": {
                        schema: fromUrlSchema,
                    },
                },
            },
            responses: {
                201: {
                    content: {
                        "application/json": {
                            schema: rawVolumeDataSchema,
                        },
                    },
                },
                ...defaultError,
            },
        },
    },
    "/volume/{idVolume}/volumeData/{type}/{idVolumeData}/update-annotations": {
        put: {
            requestParams: {
                path: idVolumeVolumeDataTypeParams,
            },
            requestBody: {
                content: {
                    "application/json": {
                        schema: updateAnnotations,
                    },
                },
            },
            responses: {
                200: {
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
    "/volumeData/{type}/{idVolumeData}/download-full": {
        get: {
            requestParams: {
                path: idVolumeDataAndType,
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
            },
        },
    },
    "/volumeData/{type}/{idVolumeData}/download-raw-file": {
        get: {
            requestParams: {
                path: idVolumeDataAndType,
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
            },
        },
    },
    "/volumeData/{type}/{idVolumeData/download-settings-file": {
        get: {
            requestParams: {
                path: idVolumeDataAndType,
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
            },
        },
    },
    "/volumeData/{type}/{idVolumeData/download-mrc-file": {
        get: {
            requestParams: {
                path: idVolumeDataAndType,
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
            },
        },
    },
    "/volume/{idVolume}/volumeData/{type}/{idVolumeData}": {
        delete: {
            requestParams: {
                path: idVolumeVolumeDataTypeParams,
            },
            responses: {
                204: {},
                ...defaultError,
            },
        },
    },
    "/cryoet/:idTomogram/": {
        get: {
            requestParams: {
                path: idTomogram,
            },
            responses: {
                200: {
                    content: {
                        "application/zip": {
                            schema: cryoetUrl,
                        },
                    },
                },
                ...defaultError,
            },
        },
    },
};
