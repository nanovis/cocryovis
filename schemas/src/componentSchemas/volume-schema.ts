import z from "zod";
import { idSchema } from "./id-param-schema";

export const volumeSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
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
