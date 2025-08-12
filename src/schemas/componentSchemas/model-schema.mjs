// @ts-check

import z from "zod";
import { checkpointSchema } from "./checkpoint-schema.mjs";
import { idSchema } from "./id-param-schema.mjs";

export const modelSchema = z.object({
    id: z.number(),
    name: z.string(),
    description: z.string(),
    creatorId: z.number().nullable(),
    checkpoints: z.array(checkpointSchema),
});

export const idModel = z
    .object({
        idModel: idSchema,
    })
    .meta({
        param: {
            name: "idModel",
            in: "path",
            required: true,
        },
        example: { idModel: "1" },
    });
