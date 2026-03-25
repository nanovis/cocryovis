import type z from "zod";
import * as Utils from "../utils/helpers";
import type {
  createFromFilesSchema,
  getResultSchema,
  resultFilesSchema,
} from "@cocryovis/schemas/result-path-schema";
import {
  maybeCompressFileToZip,
  type OptionalCompressionConfig,
} from "@/utils/compression";

export async function getResultsFromVolume(id: number) {
  const response = await Utils.sendApiRequest(`volume/${id}/results`, {
    method: "GET",
    credentials: "include",
  });
  const Results = (await response.json()) as z.infer<typeof getResultSchema>;
  return Results;
}

export async function createResultFromFiles(
  id: number,
  request: z.infer<typeof createFromFilesSchema>,
  compressionOptions?: OptionalCompressionConfig
) {
  const formData = new FormData();

  for (const file of request.files.files) {
    const compressedFile = await maybeCompressFileToZip(
      file,
      compressionOptions
    );
    formData.append("files", compressedFile);
  }

  formData.append(
    "data",
    JSON.stringify({
      idCheckpoint: request.idCheckpoint,
      volumeDescriptors: request.volumeDescriptors,
    })
  );

  const response = await Utils.sendApiRequest(`volume/${id}/results`, {
    method: "POST",
    body: formData,
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
