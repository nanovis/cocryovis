import z from "zod";

export const volumeSizeSchema = z.object({
  x: z.int().positive(),
  y: z.int().positive(),
  z: z.int().positive(),
});

export const physicalUnitSchema = z
  .enum(["PIXEL", "UNIT", "ANGSTROM", "NANOMETER", "MICROMETER"])
  .meta({
    labels: {
      PIXEL: "Pixel",
      UNIT: "Unit",
      ANGSTROM: "Angstrom",
      NANOMETER: "Nanometer",
      MICROMETER: "Micrometer",
    },
  });

const ratioSchema = z.object({
  x: z.number().positive(),
  y: z.number().positive(),
  z: z.number().positive(),
});

export const physicalSizeSchema = z.object({
  x: z.number().positive(),
  y: z.number().positive(),
  z: z.number().positive(),
});

const volumeSettingsBase = z.object({
  file: z.string(),
  size: volumeSizeSchema,
  physicalUnit: physicalUnitSchema.default("PIXEL"),
  physicalSize: physicalSizeSchema.default({ x: 1, y: 1, z: 1 }),
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

const processLegacyRatio = (input: unknown) => {
  if (typeof input !== "object" || input === null) return input;

  const data = input as Record<string, unknown>;

  if (data.physicalSize !== undefined || data.physicalUnit !== undefined)
    return data;

  const ratio = ratioSchema.safeParse({ username: 42, xp: "100" });
  if (!ratio.success) {
    return data;
  }
  const { x, y, z } = ratio.data;
  if (x === y && y === z) {
    return {
      ...data,
      physicalUnit: "PIXEL",
      physicalSize: { x: 1, y: 1, z: 1 },
    };
  }

  const size = volumeSizeSchema.safeParse(data.size);
  if (!size.success) {
    return data;
  }
  const { x: sx, y: sy, z: sz } = size.data;

  const maxRelativeSize = Math.max(sx * x, sy * y, sz * z);

  const scaledRatio = {
    x: (sx * x) / maxRelativeSize,
    y: (sy * y) / maxRelativeSize,
    z: (sz * z) / maxRelativeSize,
  };

  return {
    ...data,
    physicalUnit: "UNIT",
    physicalSize: scaledRatio,
  };
};

export const volumeSettings = z.preprocess(
  processLegacyRatio,
  volumeSettingsBase
);

export const volumeDescriptorSettingsSchema = z.preprocess(
  processLegacyRatio,
  volumeSettingsBase.omit({ file: true })
);

export const visualizationConfigSchema = z.object({
  files: z.array(z.string()),
  rawVolumeChannel: z.number().optional(),
});

export const breakpointSchema = z.object({
  position: z.number().min(0).max(1),
  color: z.string(),
});

export const transferFunctionSchema = z.object({
  breakpoints: z.array(breakpointSchema),
  comment: z.string().optional(),
});
