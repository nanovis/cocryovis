// @ts-check

import z from "zod";
import { checkpointSchema } from "./checkpoint-schema.mjs";
import { idSchema } from "./id-param-schema.mjs";

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

export const idResult = z
    .object({
        idResult: idSchema,
    })
    .meta({
        param: {
            name: "idResult",
            in: "path",
            required: true,
        },
        example: { idResult: "1" },
    });
