import z from "zod";
import * as Utils from "../utils/Helpers";
import {
  modelSchema,
  modelSchemaWithCheckpoint,
} from "#schemas/componentSchemas/model-schema.mjs";
import { createModelSchema } from "#schemas/models-path-schema.mjs";

export async function getModelsFromProjectWithCheckpoints(id: number) {
  const response = await Utils.sendReq(
    `project/${id}/models?checkpoints=true`,
    {
      method: "GET",
      credentials: "include",
    }
  );
  const models: z.infer<typeof modelSchemaWithCheckpoint>[] =
    await response.json();
  return models;
}

export async function createModel(
  id: number,
  request: z.infer<typeof createModelSchema>
) {
  const response = await Utils.sendReq(`project/${id}/models`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const Model: z.infer<typeof modelSchema> = await response.json();
  return Model;
}

export async function removeModelFromProject(
  idModel: number,
  idProject: number
) {
  await Utils.sendRequestWithToast(`project/${idProject}/model/${idModel}`, {
    method: "DELETE",
    credentials: "include",
  });
}
