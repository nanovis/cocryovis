import type { ZodOpenApiPathsObject } from "zod-openapi";
import { idVolume } from "./componentSchemas/volume-schema";
import { defaultError } from "./error-path-schema";

export const IlastikPath: ZodOpenApiPathsObject = {
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
