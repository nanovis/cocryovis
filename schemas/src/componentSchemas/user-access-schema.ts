import z from "zod";

export const userAccessSchema = z.object({
  userId: z.number().int(),
  accessLevel: z.number().int(),
});
