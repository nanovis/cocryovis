// @ts-check

import z from "zod";
import { volumeSettings } from "./volume-settings-schema.mjs";

export const pseudoLabelVolumeDataSchema = z.object({
    id: z.int(),
    path: z.string().nullable(),
    creatorId: z.int().nullable(),
    rawFilePath: z.string().nullable(),
    ...volumeSettings.shape,
    originalLabelId: z.int().nullable(),
});

export const pseudoLabelVolumeDataUpdateSchema = z.object({
    ...volumeSettings.shape,
});
