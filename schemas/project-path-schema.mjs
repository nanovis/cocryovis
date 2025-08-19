// @ts-check

import z from "zod";
import {
    idProject,
    projectSchema,
    projectSchemaDeepRes,
} from "./componentSchemas/project-schema.mjs";
import { volumeSchema } from "./componentSchemas/volume-schema.mjs";
import { modelSchemaWithCheckpoint } from "./componentSchemas/model-schema.mjs";
import { projectAccessSchema } from "./componentSchemas/project-access-schema.mjs";
import { userAccessSchema } from "./componentSchemas/user-access-schema.mjs";
import { defaultError } from "./error-path-schema.mjs";

export const projectDeepSchemaRes = projectSchema.extend({
    volumes: z.array(volumeSchema),
    models: z.array(modelSchemaWithCheckpoint),
    projectAccess: z.array(projectAccessSchema),
});

export const projectCreateSchemaReq = z.object({
    name: z.string(),
    description: z.string(),
});

// export const getProjectDeepRes = projectSchema.extend({
//     accessLevel: z.number(),
//     volumes: z.array(volumeSchema),
//     models: z.array(modelSchemaWithCheckpoint),
//     projectAccess: z.array(projectAccessSchema),
// });

export const projectAccess = z.object({
    ownerId: z.int(),
    publicAccess: z.int(),
});

export const projectAccessInfoSchema = z.object({
    projectAccess,
    userAccess: z.array(userAccessSchema),
});

export const accessInfoSchemaRes = z.object({
    projectAccess: projectAccessSchema.omit({ userId: true }),
    userAccess: z.array(userAccessSchema),
});

export const setAccessSchemaRes = z.object({
    publicAccess: z.int(),
    userAccess: z.array(userAccessSchema),
});

export const setAccessSchemaReq = z.object({
    publicAccess: z.int(),
    userAccess: z.array(userAccessSchema),
});

/**
 * @type import("zod-openapi").ZodOpenApiPathsObject
 */
export const projectPath = {
    "/projects-deep": {
        get: {
            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: z.array(projectSchemaDeepRes),
                        },
                    },
                },
                ...defaultError,
            },
        },
    },
    "/projects": {
        post: {
            requestBody: {
                content: {
                    "application/json": {
                        schema: projectCreateSchemaReq,
                    },
                },
            },
            responses: {
                201: {
                    content: {
                        "application/json": {
                            schema: projectSchema,
                        },
                    },
                },
                ...defaultError,
            },
        },
    },
    "/project/{idProject}/deep": {
        get: {
            requestParams: {
                path: idProject,
            },
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
    "/project/{idProject}/access": {
        get: {
            requestParams: {
                path: idProject,
            },

            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: projectAccessInfoSchema,
                        },
                    },
                },
                ...defaultError,
            },
        },

        post: {
            requestParams: {
                path: idProject,
            },
            requestBody: {
                content: {
                    "application/json": {
                        schema: setAccessSchemaReq,
                    },
                },
            },
            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: setAccessSchemaRes,
                        },
                    },
                },
                ...defaultError,
            },
        },
    },
    "/project/{idProject}": {
        delete: {
            requestParams: {
                path: idProject,
            },
            responses: {
                204: {},
                ...defaultError,
            },
        },
    },
};
