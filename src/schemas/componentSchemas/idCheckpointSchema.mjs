// @ts-check

import z from "zod";
import { idSchema } from "./idParamSchema.mjs";

export const idCheckpoint = z
    .object({
        idCheckpoint: idSchema,
    })
    .meta({
        param: {
            name: "idCheckpoint",
            in: "path",
            required: true,
        },
        example: { idCheckpoint: "1" },
    });
