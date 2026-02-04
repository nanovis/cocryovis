// @ts-check

import { defaultError } from "./error-path-schema.mjs";
import { projectSchemaDeepRes } from "./project-path-schema.mjs";

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
                            schema: projectSchemaDeepRes,
                        },
                    },
                },
                ...defaultError,
            },
        },
    },
};
