// @ts-check

import z from "zod";
import { defaultError } from "./errorSchema.mjs";
import { stringToInt } from "./componentSchemas/stringToint.mjs";

export const inferenceIds = z.object({
    checkpointId: z.number(),
    volumeId: z.number(),
});

export const trainingOptions = z
    .object({
        minEpochs: z.int().min(1),
        maxEpochs: z.int().min(1),
        findLearningRate: z.boolean(),
        learningRate: z.number().min(0),
        batchSize: z.int().min(1),
        loss: z
            .string()
            .toLowerCase()
            .pipe(z.enum(["mse", "bce", "awl"])),
        optimizer: z
            .string()
            .toLowerCase()
            .pipe(z.enum(["adam", "ranger"])),
        accumulateGradients: z.int().min(1),
        checkpointId: z.int(),
    })
    .refine(({ minEpochs, maxEpochs }) => minEpochs <= maxEpochs, {
        error: "Training error: Maximum epochs must be greater than minimum epochs.",
    });
export const idArray = z.array(stringToInt).nonempty();

export const trainingReq = z.object({
    trainingVolumesIds: idArray,
    validationVolumesIds: idArray,
    testingVolumesIds: idArray,
    modelId: z.number(),
    ...trainingOptions.shape,
});

/**
 * @type import("zod-openapi").ZodOpenApiPathsObject
 */
export const nanoOetziPath = {
    "/queue-inference": {
        post: {
            requestBody: {
                content: {
                    "application/json": {
                        schema: inferenceIds,
                    },
                },
            },
            responses: {
                204: {},
                ...defaultError,
            },
        },
    },
    "/queue-training": {
        post: {
            requestBody: {
                content: {
                    "application/json": {
                        schema: trainingReq,
                    },
                },
            },
            responses: {
                204: {},
                ...defaultError,
            },
        },
    },
};
