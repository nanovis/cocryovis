// @ts-check

import z from "zod";
import { idSchema } from "./id-param-schema.mjs";

export const projectSchema = z.object({
    id: z.number(),
    name: z.string(),
    description: z.string(),
    ownerId: z.number(),
    publicAccess: z.number(),
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
