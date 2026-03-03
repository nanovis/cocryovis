import type { ZodOpenApiPathsObject } from "zod-openapi";
import { idVolume } from "./componentSchemas/volume-schema";
import { defaultError } from "./error-path-schema";
import z from "zod";

export const IlastikPath: ZodOpenApiPathsObject = {
  "/volume/{idVolume}/queue-pseudo-label-generation": {
    post: {
      requestParams: {
        path: idVolume,
      },
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.object({ id: z.number() }),
            },
          },
        },
        ...defaultError,
      },
    },
  },
};
