// @ts-check

import z from "zod";
import { idProject, projectSchema } from "./componentSchemas/projectSchema.mjs";
import { volumeSchema } from "./componentSchemas/volumeSchema.mjs";
import { modelSchema } from "./componentSchemas/modelSchema.mjs";
import { projectAccessSchema } from "./componentSchemas/projectAccessSchema.mjs";
import { userAccessSchema } from "./componentSchemas/userAccessSchema.mjs";
import { defaultError } from "./errorSchema.mjs";

export const projectDeepSchemaRes = projectSchema.extend({
    volumes: z.array(volumeSchema),
    models: z.array(modelSchema),
    projectAccess: z.array(projectAccessSchema),
});

export const projectCreateSchemaReq = z.object({
    name: z.string(),
    description: z.string(),
});

export const getProjectDeepRes = projectSchema.extend({
    volumes: z.array(volumeSchema),
    models: z.array(modelSchema),
    projectAccess: z.array(projectAccessSchema),
});

export const accessInfoSchemaRes = z.object({
    projectAccess: projectAccessSchema.omit({ userId: true }),
    userAccess: z.array(userAccessSchema),
});

export const setAccessSchemaRes = z.object({
    projectAccess: projectAccessSchema.omit({ userId: true, projectId: true }),
    userAccess: z.array(userAccessSchema),
});

export const setAccessSchemaReq = z.object({
    publicAccess: z.number(),
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
                            schema: projectDeepSchemaRes,
                        },
                    },
                },
                ...defaultError,
            },
        },
    },
    "/createProject": {
        post: {
            requestBody: {
                content: {
                    "application/json": {
                        schema: projectSchema,
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
                            schema: projectSchema,
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
                            schema: accessInfoSchemaRes,
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
