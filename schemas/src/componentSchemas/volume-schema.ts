import z from "zod";
import { idSchema } from "./id-param-schema";
import { physicalUnitSchema } from "./volume-settings-schema";

export const volumeSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  physicalUnit: physicalUnitSchema,
  physicalSizeX: z.number(),
  physicalSizeY: z.number(),
  physicalSizeZ: z.number(),
  creatorId: z.number().nullable(),
});

export const volumeUpdateSchema = z.object({
  name: z.string(),
  description: z.string(),
});

export const idVolume = z
  .object({
    idVolume: idSchema,
  })
  .meta({
    param: {
      name: "idVolume",
      in: "path",
      required: true,
    },
    example: { idVolume: "123" },
  });
