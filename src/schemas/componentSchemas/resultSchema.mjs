// @ts-check

import z from "zod";
import { checkpointSchema } from "./checkpointSchema.mjs";

export const resultSchema = z.object({
    id: z.number(),
    folderPath: z.string().nullable(),
    rawVolumeChannel: z.number().nullable(),
    logFile: z.string().nullable(),
    checkpointId: z.number(),
    volumeDataId: z.number(),
});

export const resultSchemaWithCheckpoint = resultSchema.extend({
    checkpoint: checkpointSchema.nullable(),
});
