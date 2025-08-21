import z from "zod";
import * as Utils from "../utils/Helpers";
import {
  getResultSchema,
  resultFilesSchema,
} from "#schemas/result-path-schema.mjs";

export async function getResultsFromVolume(id: number) {
  const response = await Utils.sendReq(`/volume/${id}/results`, {
    method: "GET",
    credentials: "include",
  });
  const Results: z.infer<typeof getResultSchema> = await response.json();
  return Results;
}

export async function createResultFromFiles(id: number, request: FormData) {
  const response = await Utils.sendReq(
    `volume/${id}/results`,
    {
      method: "POST",
      body: request,
    },
    false
  );
  const Result: z.infer<typeof resultFilesSchema> = await response.json();
  return Result;
}

export async function removeResultFromVolume(
  idVolume: number,
  idResult: number
) {
  await Utils.sendRequestWithToast(
    `volume/${idVolume}/result/${idResult}`,
    {
      method: "DELETE",
      credentials: "include",
    },
    { successText: "Result Successfuly Removed" }
  );
}

export async function getResultData(id: number) {
  const response = await Utils.sendReq(`result/${id}/data`, {
    method: "GET",
    credentials: "include",
  });
  const file = await response.blob();
  return file;
}
