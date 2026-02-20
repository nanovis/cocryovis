import type z from "zod";
import * as Utils from "../utils/helpers";
import type { projectSchemaDeepRes } from "@cocryovis/schemas/project-path-schema";

export async function getDemo() {
  const response = await Utils.sendApiRequest("demo", {
    method: "GET",
  });
  const project = (await response.json()) as z.infer<
    typeof projectSchemaDeepRes
  >;
  return project;
}
