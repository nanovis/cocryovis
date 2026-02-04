// @ts-check

import z from "zod";

export const stringToBoolean = z
  .string()
  .transform((val) => {
    if (val.toLowerCase() === "true") return true;
    if (val.toLowerCase() === "false") return false;
  })
  .pipe(z.boolean());