import type z from "zod";
import * as Utils from "../utils/Helpers";
import type {
  createVolumeReq,
  getVolumeSchema,
  volumeQuerySchema,
  volumesDeepSchemaRes,
} from "#schemas/volume-path-schema.mjs";
import type {
  volumeSchema,
  volumeUpdateSchema,
} from "#schemas/componentSchemas/volume-schema.mjs";

export async function getVolumesFromProjectDeep(id: number) {
  const response = await Utils.sendApiRequest(`project/${id}/volumes/deep`, {
    method: "GET",
    credentials: "include",
  });
  const volumes: z.infer<typeof volumesDeepSchemaRes> = await response.json();
  return volumes;
}

export async function createVolume(
  id: number,
  request: z.input<typeof createVolumeReq>
) {
  const response = await Utils.sendApiRequest(`project/${id}/volumes`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const volume: z.infer<typeof volumeSchema> = await response.json();
  return volume;
}

export async function getVolumeWithSparseVolumes(Id: number) {
  const query: z.input<typeof volumeQuerySchema> = {
    sparseVolumes: "true",
  };
  const response = await Utils.sendApiRequest(
    `volume/${Id}`,
    {
      method: "GET",
    },
    { query }
  );
  const volume: z.infer<typeof getVolumeSchema> = await response.json();
  return volume;
}

export async function deleteVolume(volumeId: number) {
  await Utils.sendApiRequest(`volume/${volumeId}`, {
    method: "DELETE",
    credentials: "include",
  });
}

export async function updateVolume(
  id: number,
  request: z.input<typeof volumeUpdateSchema>
) {
  const response = await Utils.sendApiRequest(`/volume/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const volume: z.infer<typeof volumeSchema> = await response.json();
  return volume;
}
