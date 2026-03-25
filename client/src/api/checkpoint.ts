import type { checkpointSchemaArray } from "@cocryovis/schemas/componentSchemas/checkpoint-schema";
import type z from "zod";
import * as Utils from "../utils/helpers";
import type { multipleFileSchema } from "@cocryovis/schemas/componentSchemas/file-schema";
import {
  maybeCompressFileToZip,
  type OptionalCompressionConfig,
} from "@/utils/compression";

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
  const checkpoints = (await response.json()) as z.infer<
    typeof checkpointSchemaArray
  >;
  return checkpoints;
}

export async function uploadCheckpoints(
  id: number,
  request: z.infer<typeof multipleFileSchema>,
  compressionOptions?: OptionalCompressionConfig
) {
  const formData = new FormData();
  for (const file of request.files) {
    const compressedFile = await maybeCompressFileToZip(
      file,
      compressionOptions
    );
    formData.append("files", compressedFile);
  }

  const response = await Utils.sendApiRequest(`model/${id}/checkpoints`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const checkpoints = (await response.json()) as z.infer<
    typeof checkpointSchemaArray
  >;
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
