import type z from "zod";
import * as Utils from "../utils/helpers";
import {
  maybeCompressFileToZip,
  type OptionalCompressionConfig,
} from "../utils/compression";
import type { rawVolumeDataSchema } from "@cocryovis/schemas/componentSchemas/raw-volume-data-schema";
import type { sparseLabelVolumeDataSchema } from "@cocryovis/schemas/componentSchemas/sparse-label-volume-data-schema";
import type { pseudoLabelVolumeDataSchema } from "@cocryovis/schemas/componentSchemas/pseudo-label-volume-data-schema";
import type { typeSchema } from "@cocryovis/schemas/componentSchemas/volume-data-schema";
import type {
  createFromFilesSchema,
  fromUrlSchema,
  updateAnnotationsSchema,
  volumeDataUpdate,
} from "@cocryovis/schemas/volume-data-path-schema";

type RawVolumeData = z.infer<typeof rawVolumeDataSchema>;
type SparseLabeledVolumeData = z.infer<typeof sparseLabelVolumeDataSchema>;
type PseudoLabeledVolumeData = z.infer<typeof pseudoLabelVolumeDataSchema>;
export interface VolumeDataMap {
  RawVolumeData: RawVolumeData;
  SparseLabeledVolumeData: SparseLabeledVolumeData;
  PseudoLabeledVolumeData: PseudoLabeledVolumeData;
}

export async function getVolumeDataById<T extends keyof VolumeDataMap>(
  type: T,
  id: number
) {
  const response = await Utils.sendApiRequest(`volumeData/${type}/${id}`, {
    method: "GET",
    credentials: "include",
  });

  const volumeData = (await response.json()) as VolumeDataMap[T];
  return volumeData;
}

export async function updateVolumeData<T extends keyof VolumeDataMap>(
  type: T,
  id: number,
  request: z.input<typeof volumeDataUpdate>
) {
  const response = await Utils.sendApiRequest(`volumeData/${type}/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  const volumeData = (await response.json()) as VolumeDataMap[T];
  return volumeData;
}

export async function getVolumeData(
  type: z.input<typeof typeSchema>,
  id: number
) {
  const response = await Utils.sendApiRequest(`volumeData/${type}/${id}/data`, {
    method: "GET",
    credentials: "include",
  });
  return await response.arrayBuffer();
}

export async function getVolumeVisualizationFiles(
  type: keyof VolumeDataMap,
  id: number
) {
  const response = await Utils.sendApiRequest(
    `volumeData/${type}/${id}/visualization-data`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  return await response.blob();
}

export async function createFromFiles<T extends keyof VolumeDataMap>(
  type: T,
  id: number,
  request: z.input<typeof createFromFilesSchema>,
  compressionOptions?: OptionalCompressionConfig
) {
  const formData = new FormData();
  const fileToUpload = await maybeCompressFileToZip(
    request.rawFile,
    compressionOptions
  );

  formData.append("rawFile", fileToUpload);
  formData.append("settings", JSON.stringify(request.volumeSettings));
  if (request.reconstructionParameters !== undefined) {
    formData.append(
      "reconstructionParameters",
      JSON.stringify(request.reconstructionParameters)
    );
  }

  const response = await Utils.sendApiRequest(
    `volume/${id}/volumeData/${type}/from-files`,
    {
      method: "POST",
      credentials: "include",
      body: formData,
    }
  );
  const volumeData = (await response.json()) as VolumeDataMap[T];
  return volumeData;
}

export async function createFromMrcFile(
  id: number,
  mrcFile: File,
  compressionOptions?: OptionalCompressionConfig
) {
  const formData = new FormData();

  const compressedFile = await maybeCompressFileToZip(
    mrcFile,
    compressionOptions
  );

  formData.append("files", compressedFile);
  const response = await Utils.sendApiRequest(
    `volume/${id}/volumeData/RawVolumeData/from-mrc-file`,
    {
      method: "POST",
      credentials: "include",
      body: formData,
    }
  );
  const rawVolumeData = (await response.json()) as RawVolumeData;
  return rawVolumeData;
}

export async function createFromUrl(
  id: number,
  request: z.input<typeof fromUrlSchema>
) {
  const response = await Utils.sendApiRequest(
    `volume/${id}/volumeData/RawVolumeData/from-url`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    }
  );
  const rawVolumeData = (await response.json()) as RawVolumeData;
  return rawVolumeData;
}

export async function updateAnnotations(
  idVolume: number,
  idVolumeData: number,
  request: z.input<typeof updateAnnotationsSchema>,
  compressionOptions?: OptionalCompressionConfig
) {
  const formData = new FormData();

  const fileToUpload = await maybeCompressFileToZip(
    request.rawFile,
    compressionOptions
  );
  formData.append("rawFile", fileToUpload);

  const response = await Utils.sendApiRequest(
    `volume/${idVolume}/volumeData/SparseLabeledVolumeData/${idVolumeData}/update-annotations`,
    {
      method: "PUT",
      credentials: "include",
      body: formData,
    }
  );
  const volumeData = (await response.json()) as z.infer<
    typeof sparseLabelVolumeDataSchema
  >;
  return volumeData;
}

export async function downloadFullVolumeData(
  type: keyof VolumeDataMap,
  id: number
) {
  const response = await Utils.sendApiRequest(
    `volumeData/${type}/${id}/download-full`,
    {
      method: "GET",
    }
  );
  return await response.blob();
}

export async function downloadRawFile(id: number) {
  const response = await Utils.sendApiRequest(
    `volumeData/SparseLabeledVolumeData/${id}/download-raw-file`,
    {
      method: "GET",
    }
  );
  return await response.blob();
}

export async function deleteVolumeData(
  type: keyof VolumeDataMap,
  idVolumeData: number
) {
  await Utils.sendApiRequest(`volumeData/${type}/${idVolumeData}`, {
    method: "DELETE",
    credentials: "include",
  });
}
