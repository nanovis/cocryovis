import type z from "zod";
import * as Utils from "../utils/helpers";
import type {
  modelSchema,
  modelSchemaWithCheckpoint,
} from "@cocryovis/schemas/componentSchemas/model-schema";
import type {
  createModelSchema,
  getModelQuerySchema,
} from "@cocryovis/schemas/models-path-schema";

export async function getModelsFromProjectWithCheckpoints(id: number) {
  const query: z.input<typeof getModelQuerySchema> = {
    checkpoints: "true",
  };
  const response = await Utils.sendApiRequest(
    `project/${id}/models`,
    {
      method: "GET",
      credentials: "include",
    },
    { query }
  );
  const models = (await response.json()) as z.infer<
    typeof modelSchemaWithCheckpoint
  >[];
  return models;
}

export async function createModel(
  id: number,
  request: z.input<typeof createModelSchema>
) {
  const response = await Utils.sendApiRequest(`project/${id}/models`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const model = (await response.json()) as z.infer<typeof modelSchema>;
  return model;
}

export async function deleteModel(idModel: number) {
  await Utils.sendApiRequest(`/model/${idModel}`, {
    method: "DELETE",
    credentials: "include",
  });
}
