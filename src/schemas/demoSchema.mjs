// @ts-check

import { z } from "zod";
import { defaultError } from "./errorSchema.mjs";
import { projectSchema } from "./componentSchemas/projectSchema.mjs";
import { projectAccessSchema } from "./componentSchemas/projectAccessSchema.mjs";
import { getVolumeSchema } from "./volumeMainSchema.mjs";
import { getModelsSchema } from "./modelsMainSchema.mjs";

export const demoSchema = projectSchema.extend({
    accessLevel: z.number(),
    volumes: getVolumeSchema.omit({ projects: true }),
    models: getModelsSchema.omit({ projects: true }),
    projectAccess: projectAccessSchema,
});

/**
 * @type import("zod-openapi").ZodOpenApiPathsObject
 */

export const demoPath = {
    "/demo": {
        get: {
            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: demoSchema,
                        },
                    },
                },
                ...defaultError,
            },
        },
    },
};
