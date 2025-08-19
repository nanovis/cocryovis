// @ts-check

import z from "zod";
import { idSchema } from "./id-param-schema.mjs";
import { modelSchemaWithCheckpoint } from "./model-schema.mjs";
import { volumeSchemaDeep } from "./volume-schema.mjs";

export const projectSchema = z.object({
    id: z.int(),
    name: z.string(),
    description: z.string(),
    ownerId: z.int(),
    publicAccess: z.int(),
});

export const projectSchemaDeepRes = projectSchema.extend({
    accessLevel: z.int(),
    volumes: z.array(volumeSchemaDeep),
    models: z.array(modelSchemaWithCheckpoint),
});

export const idProject = z
    .object({
        idProject: idSchema,
    })
    .meta({
        param: {
            name: "idProject",
            in: "path",
            required: true,
        },
        example: { idProject: "1" },
    });
