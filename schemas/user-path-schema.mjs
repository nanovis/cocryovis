// @ts-check

import { z } from "zod";
import { defaultError, generateErrors } from "./error-path-schema.mjs";
import { volumeSchema } from "./componentSchemas/volume-schema.mjs";
import { modelSchema } from "./componentSchemas/model-schema.mjs";
import { checkpointSchema } from "./componentSchemas/checkpoint-schema.mjs";

export const registerSchema = z.object({
    username: z.string().min(1),
    name: z.string().min(1),
    email: z.email().meta({ example: "email@example.com" }),
    password: z.string().min(6),
    // .regex(/[A-Z]/, "The password must contain an uppercase letter")
    // .regex(/[a-z]/, "The password must contain a lowercase letter")
    // .regex(/[0-9]/, "The password must contain a number")
    // .regex(/[^A-Za-z0-9]/, "The password must contain a special character"),
});
export const loginSchemaReq = z.object({
    username: z.string(),
    password: z.string(),
});

export const taskHistorySchema = z.object({
    enqueuedTime: z.date(),
    startTime: z.date().nullable(),
    endTime: z.date().nullable(),
    id: z.int(),
    taskType: z.int(),
    taskStatus: z.int(),
    userId: z.int(),
    logFile: z.string().nullable(),
    volumeId: z.int().nullable(),
    modelId: z.int().nullable(),
    checkpointId: z.int().nullable(),
    volume: volumeSchema.nullable(),
    model: modelSchema.nullable(),
    checkpoint: checkpointSchema.nullable(),
});

export const statusSchema = z.object({
    taskHistory: z.array(taskHistorySchema),
    cpuTaskQueue: z.array(taskHistorySchema),
    gpuTaskQueue: z.array(taskHistorySchema),
});

export const updateUserSchema = z.object({
    username: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    email: z.email().meta({ example: "email@example.com" }).optional(),
    password: z.string().min(6).optional(),
});

export const publicUser = z.object({
    id: z.int(),
    username: z.string(),
    name: z.string(),
    email: z.email(),
});

export const usersArray = z.array(publicUser);

/**
 * @type import("zod-openapi").ZodOpenApiPathsObject
 */
export const userPath = {
    "/register": {
        post: {
            requestBody: {
                content: {
                    "application/json": {
                        schema: registerSchema,
                    },
                },
            },

            responses: {
                201: {
                    content: {
                        "application/json": {
                            schema: publicUser,
                        },
                    },
                },
                ...generateErrors([401]),
                ...defaultError,
            },
        },
    },
    "/login": {
        post: {
            requestBody: {
                content: {
                    "application/json": {
                        schema: loginSchemaReq,
                    },
                },
            },
            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: publicUser,
                        },
                    },
                },
                ...generateErrors([401]),
                ...defaultError,
            },
        },
    },
    "/logout": {
        post: {
            summary: "Logs the user out",
            responses: {
                204: {
                    description: "User logged out",
                },
                ...defaultError,
            },
        },
    },

    "/getLoggedUserData": {
        get: {
            responses: {
                201: {
                    content: {
                        "application/json": {
                            schema: publicUser,
                        },
                    },
                },
                ...generateErrors([401]),
                ...defaultError,
            },
        },
    },
    "/users": {
        get: {
            responses: {
                200: {
                    description: "List of users",
                    content: {
                        "application/json": {
                            schema: usersArray,
                        },
                    },
                },
                ...defaultError,
            },
        },
    },
    "/status": {
        get: {
            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: statusSchema,
                        },
                    },
                },
                ...defaultError,
            },
        },
    },
    "/user": {
        put: {
            requestBody: {
                content: {
                    "application/json": {
                        schema: updateUserSchema,
                    },
                },
            },
            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: publicUser,
                        },
                    },
                },
                ...defaultError,
                ...generateErrors([400]),
            },
        },
    },
};
