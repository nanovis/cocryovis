// @ts-check

import z from "zod";
import { idSchema } from "./idParamSchema.mjs";

export const volumeSchema = z.object({
    id: z.number(),
    name: z.string(),
    description: z.string(),
    creatorId: z.number().nullable(),
    rawDataId: z.number().nullable(),
});

export const idVolume = z
    .object({
        idVolume: idSchema,
    })
    .meta({
        param: {
            name: "idVolume",
            in: "path",
            required: true,
        },
        example: { idVolume: "123" },
    });
