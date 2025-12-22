import type z from "zod";
import * as Utils from "../utils/Helpers";
import type { projectSchemaDeepRes } from "#schemas/project-path-schema.mjs";

export async function getDemo() {
  const response = await Utils.sendApiRequest("demo", {
    method: "GET",
  });
  const project: z.infer<typeof projectSchemaDeepRes> = await response.json();
  return project;
}
