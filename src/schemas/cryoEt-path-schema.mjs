// @ts-check

import z from "zod";
import { defaultError } from "./error-path-schema.mjs";

export const reconstructionOptions = z.object({
    volume_depth: z.int().positive(),
    tiled: z.boolean().default(true),
    crop: z.boolean().default(true),
    is_data_linearized: z.boolean().default(false),
    delinearize_result: z.boolean().default(true),
    data_term_end: z.boolean().default(false),
    data_term_iters: z.int().min(1).max(20).default(2),
    proximal_iters: z.int().min(1).max(200).default(80),
    sample_rate: z.number().min(0.25).max(1).default(0.5),
    chill_factor: z.number().min(0.001).max(1).default(0.2),
    lambda: z.number().min(0.1).max(2000).default(1000),
    number_extra_rows: z
        .int()
        .min(60)
        .refine((n) => n % 2 === 0, {
            message: "Extra rows must be an even integer above 60.",
        })
        .default(80),
    starting_angle: z.number().default(-60),
    angle_step: z.number().default(3),
    nlm_skip: z.int().min(1).max(9).default(3),
});

export const IMODOptions = z.object({
    peak: z.number().default(10),
    diff: z.number().default(10),
    grow: z.number().default(4),
    iterations: z.int().min(1).default(3),
    numOfPatches: z.int().min(1).default(4),
    patchSize: z.int().min(1).default(680),
    patchRadius: z.number().min(0).max(0.5).default(0.125),
    rotationAngle: z.number().default(60),
});

export const CTFOptions = z.object({
    highTension: z.number().default(300),
    sphericalAberration: z.number().default(2.7),
    amplitudeContrast: z.number().default(0.1),
    pixelSize: z.number().default(1.0),
    tileSize: z.int().min(1).default(512),
});

export const motionCorrectionOptions = z.object({
    patchSize: z.int().min(1).default(32),
    iterations: z.int().min(1).default(10),
    tolerance: z.number().default(0.1),
    pixelSize: z.number().default(1.0),
    fmDose: z.number().default(0),
    highTension: z.number().default(300),
});

export const tiltSeriesOptions = z.object({
    reconstruction: reconstructionOptions,
    alignment: IMODOptions.optional(),
    ctf: CTFOptions.optional(),
    motionCorrection: motionCorrectionOptions.optional(),
});

export const data = z.object({
    volumeId: z.int(),
    options: tiltSeriesOptions,
});

export const tiltSeries = z.object({
    tiltSeries: z.file(),
    data,
});

export const tiltSeriesValidation = tiltSeries.omit({
    tiltSeries: true,
});

/**
 * @type import("zod-openapi").ZodOpenApiPathsObject
 */
export const cryoEtPath = {
    "/tilt-series-reconstruction": {
        post: {
            requestBody: {
                content: {
                    "multipart/form-data": {
                        schema: tiltSeries,
                    },
                },
            },
            responses: {
                201: {},
                ...defaultError,
            },
        },
    },
};
