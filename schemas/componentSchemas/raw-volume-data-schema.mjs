// @ts-check

import z from "zod";
import { volumeSettings } from "./volume-settings-schema.mjs";

export const rawVolumeDataSchema = z.object({
    id: z.int(),
    path: z.string().nullable(),
    creatorId: z.int().nullable(),
    rawFilePath: z.string().nullable(),
    ...volumeSettings.shape,
    mrcFilePath: z.string().nullable(),
});

export const rawVolumeDataUpdateSchema = z.object({
    ...volumeSettings.shape,
});
