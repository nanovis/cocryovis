// @ts-check

import z from "zod";
export const projectAccessSchema = z.object({
    userId: z.number(),
    projectId: z.number(),
    accessLevel: z.number(),
});
