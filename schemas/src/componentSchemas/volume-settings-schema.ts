import z from "zod";

export const volumeSizeSchema = z.object({
  x: z.int().positive(),
  y: z.int().positive(),
  z: z.int().positive(),
});

export const physicalUnitSchema = z.enum([
  "PIXEL",
  "UNIT",
  "ANGSTROM",
  "NANOMETER",
  "MICROMETER",
]);
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

  if ("ratio" in data && data.physicalSize === undefined) {
    return {
      ...data,
      physicalUnit: "PIXEL",
      physicalSize: data.ratio,
    };
  }

  return data;
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

export const transferFunctionSchema = z.object({
  rampLow: z.number().min(0).max(1),
  rampHigh: z.number().min(0).max(1),
  color: z.object({
    x: z.number().min(0).max(255),
    y: z.number().min(0).max(255),
    z: z.number().min(0).max(255),
  }),
  comment: z.string().optional(),
});
