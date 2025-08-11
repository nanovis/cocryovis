// @ts-check

import z from "zod";
import { idSchema } from "./idParamSchema.mjs";

export const idModel = z
    .object({
        idModel: idSchema,
    })
    .meta({
        param: {
            name: "idModel",
            in: "path",
            required: true,
        },
        example: { idModel: "1" },
    });
