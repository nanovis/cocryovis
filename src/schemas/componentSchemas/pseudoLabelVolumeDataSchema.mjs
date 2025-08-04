// @ts-check

import z from "zod";

export const pseudoLabelVolumeDataSchema = z.object({
    id: z.number(),
    path: z.string().nullable(),
    creatorId: z.number().nullable(),
    rawFilePath: z.string().nullable(),
    settings: z.string().nullable(),
    originalLabelId: z.number().nullable(),
});
