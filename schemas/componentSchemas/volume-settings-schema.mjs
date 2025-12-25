// @ts-check

import z from "zod";

export const volumeSettings = z.object({
    file: z.string(),
    size: z.object({
        x: z.int().positive(),
        y: z.int().positive(),
        z: z.int().positive(),
    }),
    ratio: z.object({
        x: z.number().positive(),
        y: z.number().positive(),
        z: z.number().positive(),
    }),
    // TODO manual checking for this
    // bytesPerVoxel: z.literal([1, 2, 4, 8]),
    // usedBits: z.literal([8, 16, 32, 64]),
    bytesPerVoxel: z.int().refine((v) => [1, 2, 4, 8].includes(v)),
    usedBits: z.int().refine((v) => [8, 16, 32, 64].includes(v)),
    skipBytes: z.number().default(0),
    isLittleEndian: z.boolean(),
    isSigned: z.boolean().default(false),
    addValue: z.number().default(0),
});

export const volumeDescriptorSettings = volumeSettings.omit({ file: true });

export const visualizationConfigSchema = z.object({
    files: z.array(z.string()),
    rawVolumeChannel: z.number().optional(),
});
