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
  const Results = (await response.json()) as z.infer<typeof getResultSchema>;
  return Results;
}

export async function createResultFromFiles(id: number, request: FormData) {
  const response = await Utils.sendApiRequest(`volume/${id}/results`, {
    method: "POST",
    body: request,
  });
  const result = (await response.json()) as z.infer<typeof resultFilesSchema>;
  return result;
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
