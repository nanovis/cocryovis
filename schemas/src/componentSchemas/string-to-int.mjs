// @ts-check

import z from "zod";

export const stringToInt = z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.int());
