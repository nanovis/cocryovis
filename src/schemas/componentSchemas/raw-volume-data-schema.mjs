// @ts-check

import z from "zod";

export const rawVolumeDataSchema = z.object({
    id: z.number(),
    path: z.string().nullable(),
    creatorId: z.number().nullable(),
    rawFilePath: z.string().nullable(),
    settings: z.string().nullable(),
    mrcFilePath: z.string().nullable(),
});

export const rawVolumeDataUpdateSchema = z.object({
    settings: z.string().nullable().optional(),
});

