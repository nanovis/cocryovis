import { checkpointSchemaArray } from "#schemas/componentSchemas/checkpoint-schema.mjs";
import z from "zod";
import * as Utils from "../utils/Helpers";

export async function removeFromModel(idModel: number, idCheckpoint: number) {
  await Utils.sendApiRequest(
    `model/${idModel}/checkpoint/${idCheckpoint}`,
    {
      method: "DELETE",
      credentials: "include",
    }
  );
}

export async function getCheckpointsFromModel(id: number) {
  const response = await Utils.sendApiRequest(`model/${id}/checkpoints`, {
    method: "GET",
    credentials: "include",
  });
  const checkpoints: z.infer<typeof checkpointSchemaArray> =
    await response.json();
  return checkpoints;
}

export async function uploadCheckpoints(id: number, request: FormData) {
  const response = await Utils.sendApiRequest(`model/${id}/checkpoints`, {
    method: "POST",
    credentials: "include",
    body: request,
  });
  const checkpoints: z.infer<typeof checkpointSchemaArray> =
    await response.json();
  return checkpoints;
}

export async function checkpointToText(id: number) {
  const response = await Utils.sendApiRequest(
    `checkpoint/${id}/as-text`,
    {
      method: "GET",
      credentials: "include",
    },
  );
  const checkpointTxt = await response.text();
  return checkpointTxt;
}

export async function checkpointFileToText(request: FormData) {
  const response = await Utils.sendApiRequest(
    `checkpoint/to-text`,
    {
      method: "POST",
      body: request,
    },
  );
  const checkpointTxt = await response.text();
  return checkpointTxt;
}
