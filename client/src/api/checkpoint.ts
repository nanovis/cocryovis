import type { checkpointSchemaArray } from "@cocryovis/schemas/componentSchemas/checkpoint-schema";
import type z from "zod";
import * as Utils from "../utils/helpers";

export async function deleteCheckpoint(idCheckpoint: number) {
  await Utils.sendApiRequest(`checkpoint/${idCheckpoint}`, {
    method: "DELETE",
    credentials: "include",
  });
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
  const response = await Utils.sendApiRequest(`checkpoint/${id}/as-text`, {
    method: "GET",
    credentials: "include",
  });
  return await response.text();
}

export async function checkpointFileToText(request: FormData) {
  const response = await Utils.sendApiRequest(`checkpoint/to-text`, {
    method: "POST",
    body: request,
  });
  return await response.text();
}
