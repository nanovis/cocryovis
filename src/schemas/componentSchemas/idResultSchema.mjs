// @ts-check

import z from "zod";
import { idSchema } from "./idParamSchema.mjs";

export const idResult = z
    .object({
        idResult: idSchema,
    })
    .meta({
        param: {
            name: "idResult",
            in: "path",
            required: true,
        },
        example: { idResult: "1" },
    });
