// @ts-check

import z from "zod";

export const sparseLabelVolumeDataSchema = z.object({
    id: z.number(),
    path: z.string().nullable(),
    creatorId: z.number().nullable(),
    rawFilePath: z.string().nullable(),
    settings: z.string().nullable(),
    color: z.string().nullable(),
});
