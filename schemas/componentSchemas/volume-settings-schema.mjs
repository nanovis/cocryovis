// @ts-check

import z from "zod";

export const vector3 = z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
});

export const volumeSettings = z.object({
    file: z.string(),
    size: z.object({
        x: z.number().positive(),
        y: z.number().positive(),
        z: z.number().positive(),
    }),
    ratio: z.object({
        x: z.int().positive(),
        y: z.int().positive(),
        z: z.int().positive(),
    }),
    bytesPerVoxel: z.literal([1, 2, 4, 8]),
    usedBits: z.literal([8, 16, 32, 64]),
    skipBytes: z.number().default(0),
    isLittleEndian: z.boolean(),
    isSigned: z.boolean(),
    addValue: z.number().default(0),
});
