import type z from "zod";
import * as Utils from "../utils/Helpers";
import type { rawVolumeDataSchema } from "#schemas/componentSchemas/raw-volume-data-schema.mjs";
import type { sparseLabelVolumeDataSchema } from "#schemas/componentSchemas/sparse-label-volume-data-schema.mjs";
import type { pseudoLabelVolumeDataSchema } from "#schemas/componentSchemas/pseudo-label-volume-data-schema.mjs";
import type { typeSchema } from "#schemas/componentSchemas/volume-data-schema.mjs";
import type {
  createFromFilesSchema,
  fromUrlSchema,
  updateAnnotationsSchema,
  volumeDataUpdate,
} from "#schemas/volume-data-path-schema.mjs";

type RawVolumeData = z.infer<typeof rawVolumeDataSchema>;
type SparseLabeledVolumeData = z.infer<typeof sparseLabelVolumeDataSchema>;
type PseudoLabeledVolumeData = z.infer<typeof pseudoLabelVolumeDataSchema>;
interface VolumeDataMap {
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

  const volumeData: VolumeDataMap[T] = await response.json();
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

  const volumeData: VolumeDataMap[T] = await response.json();
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
  request: z.input<typeof createFromFilesSchema>
) {
  const formData = new FormData();
  formData.append("rawFile", request.rawFile);
  formData.append("settings", JSON.stringify(request.volumeSettings));
  const response = await Utils.sendApiRequest(
    `volume/${id}/volumeData/${type}/from-files`,
    {
      method: "POST",
      credentials: "include",
      body: formData,
    }
  );
  const volumeData: VolumeDataMap[T] = await response.json();
  return volumeData;
}

export async function createFromMrcFile(id: number, request: FormData) {
  const response = await Utils.sendApiRequest(
    `volume/${id}/volumeData/RawVolumeData/from-mrc-file`,
    {
      method: "POST",
      credentials: "include",
      body: request,
    }
  );
  const rawVolumeData: RawVolumeData = await response.json();
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
  const rawVolumeData: RawVolumeData = await response.json();
  return rawVolumeData;
}

export async function updateAnnotations(
  idVolume: number,
  idVolumeData: number,
  request: z.input<typeof updateAnnotationsSchema>
) {
  const formData = new FormData();
  formData.append("rawFile", request.rawFile);

  const response = await Utils.sendApiRequest(
    `volume/${idVolume}/volumeData/SparseLabeledVolumeData/${idVolumeData}/update-annotations`,
    {
      method: "PUT",
      credentials: "include",
      body: formData,
    }
  );
  const volumeData: z.infer<typeof sparseLabelVolumeDataSchema> =
    await response.json();
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
