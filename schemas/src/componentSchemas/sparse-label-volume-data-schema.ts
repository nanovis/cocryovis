import z from "zod";

export const sparseLabelVolumeDataSchema = z.object({
  id: z.int(),
  creatorId: z.int().nullable(),
  name: z.string(),
  sizeX: z.int(),
  sizeY: z.int(),
  sizeZ: z.int(),
  skipBytes: z.int(),
  isLittleEndian: z.boolean(),
  isSigned: z.boolean(),
  addValue: z.int(),
  bytesPerVoxel: z.int(),
  usedBits: z.int(),
  color: z.string().nullable(),
  volumeId: z.int(),
});

export const sparseLabelVolumeDataUpdateSchema = z.object({
  name: z.string().optional(),
  sizeX: z.int().optional(),
  sizeY: z.int().optional(),
  sizeZ: z.int().optional(),
  skipBytes: z.int().optional(),
  isLittleEndian: z.boolean().optional(),
  isSigned: z.boolean().optional(),
  addValue: z.int().optional(),
  bytesPerVoxel: z.int().optional(),
  usedBits: z.int().optional(),
  color: z.string().nullable().optional(),
});
