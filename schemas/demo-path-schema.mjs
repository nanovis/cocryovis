// @ts-check

import { z } from "zod";
import { defaultError } from "./error-path-schema.mjs";
import { projectSchema } from "./componentSchemas/project-schema.mjs";
import { projectAccessSchema } from "./componentSchemas/project-access-schema.mjs";
import { getVolumeSchema } from "./volume-path-schema.mjs";
import { getModelsSchema } from "./models-path-schema.mjs";

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
