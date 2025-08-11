// @ts-check

import z from "zod";

export const idSchema = z
    .string()
    .regex(/^\d+$/, "Must be numeric")
    .transform((val) => Number(val));
