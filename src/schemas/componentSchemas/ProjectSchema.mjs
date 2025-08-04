// @ts-check

import z from "zod";

export const projectSchema = z.object({
    id: z.number(),
    name: z.string(),
    description: z.string(),
    ownerId: z.number(),
    publicAccess: z.number(),
});
