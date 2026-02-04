import z from "zod";

export const stringToBoolean = z
  .string()
  .transform((val) => {
    if (val.toLowerCase() === "true") return true;
    return false;
  })
  .pipe(z.boolean());
