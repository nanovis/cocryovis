// @ts-check

import z from "zod";
import { checkpointSchema } from "./checkpointSchema.mjs";

export const modelSchema = z.object({
    id: z.number(),
    name: z.string(),
    description: z.string(),
    creatorId: z.number().nullable(),
    checkpoints: z.array(checkpointSchema),
});
