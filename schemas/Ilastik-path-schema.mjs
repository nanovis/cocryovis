// @ts-check

import { idVolume } from "./componentSchemas/volume-schema.mjs";
import { defaultError } from "./error-path-schema.mjs";

/**
 * @type import("zod-openapi").ZodOpenApiPathsObject
 */
export const IlastikPath = {
    "/volume/{idVolume}/queue-pseudo-label-generation": {
        post: {
            requestParams: {
                path: idVolume,
            },
            responses: {
                201: {},
                ...defaultError,
            },
        },
    },
};
 