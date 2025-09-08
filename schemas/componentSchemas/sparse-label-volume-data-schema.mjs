// @ts-check

import z from "zod";
import { volumeSettings } from "./volume-settings-schema.mjs";

export const sparseLabelVolumeDataSchema = z.object({
    id: z.int(),
    path: z.string().nullable(),
    creatorId: z.int().nullable(),
    rawFilePath: z.string().nullable(),
    ...volumeSettings.shape,
    color: z.string().nullable(),
});

export const sparseLabelVolumeDataUpdateSchema = z.object({
    ...volumeSettings.shape,
    color: z.string().nullable().optional(),
});
