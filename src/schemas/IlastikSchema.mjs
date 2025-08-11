// @ts-check

import { idVolume } from "./componentSchemas/volumeSchema.mjs";
import { defaultError } from "./errorSchema.mjs";

/**
 * @type import("zod-openapi").ZodOpenApiPathsObject
 */
export const IlastikPath = {
    "/volume/{idVolume}/queue-pseudo-label-generation": {
        get: {
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
 