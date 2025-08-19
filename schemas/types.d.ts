// @ts-check
import z from "zod"
import { publicUser } from "./user-path-schema.mjs";

export type PublicUser = z.infer<typeof publicUser>