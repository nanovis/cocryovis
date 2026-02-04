import type { ZodOpenApiPathsObject } from "zod-openapi";
import { defaultError } from "./error-path-schema";
import { projectSchemaDeepRes } from "./project-path-schema";

export const demoPath: ZodOpenApiPathsObject = {
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
