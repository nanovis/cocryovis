// @ts-check

import z from "zod";
import { idSchema } from "./idParamSchema.mjs";

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
        example: { idVolume: "1" },
    });
