import type z from "zod";
import * as Utils from "../utils/helpers";
import type {
  getResultSchema,
  resultFilesSchema,
} from "@cocryovis/schemas/result-path-schema";

export async function getResultsFromVolume(id: number) {
  const response = await Utils.sendApiRequest(`/volume/${id}/results`, {
    method: "GET",
    credentials: "include",
  });
  const Results: z.infer<typeof getResultSchema> = await response.json();
  return Results;
}

export async function createResultFromFiles(id: number, request: FormData) {
  const response = await Utils.sendApiRequest(`volume/${id}/results`, {
    method: "POST",
    body: request,
  });
  const Result: z.infer<typeof resultFilesSchema> = await response.json();
  return Result;
}

export async function deleteResult(idResult: number) {
  await Utils.sendApiRequest(`result/${idResult}`, {
    method: "DELETE",
    credentials: "include",
  });
}

export async function getResultData(id: number) {
  const response = await Utils.sendApiRequest(`result/${id}/data`, {
    method: "GET",
    credentials: "include",
  });
  return await response.blob();
}
