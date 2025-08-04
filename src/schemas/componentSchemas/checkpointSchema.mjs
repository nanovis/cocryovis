// @ts-check

import z from "zod";

export const checkpointSchema = z.object({
    id: z.number(),
    filePath: z.string().nullable(),
    folderPath: z.string().nullable(),
    creatorId: z.number().nullable(),
});
