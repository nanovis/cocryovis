import z from "zod";
import * as Utils from "../utils/Helpers";
import { projectSchemaDeepRes } from "#schemas/project-path-schema.mjs";

export async function getDemo() {
  const response = await Utils.sendReq(
    "demo",
    {
      method: "GET",
    },
    false
  );
  const project: z.infer<typeof projectSchemaDeepRes> = await response.json();
  return project;
}
