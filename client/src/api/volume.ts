import z from "zod";
import * as Utils from "../utils/Helpers";
import {
  createVolumeReq,
  getVolumeSchema,
  volumeQuerySchema,
  volumesDeepSchemaRes,
} from "#schemas/volume-path-schema.mjs";
import { volumeSchema } from "#schemas/componentSchemas/volume-schema.mjs";
import { sparseLabelVolumeDataSchema } from "#schemas/componentSchemas/sparse-label-volume-data-schema.mjs";

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
    `/volume/${Id}`,
    {
      method: "GET",
    },
    {query}
  );
  const volume: z.infer<typeof getVolumeSchema> = await response.json();
  return volume;
}

export async function removeFromProject(projectId: number, volumeId: number) {
  await Utils.sendApiRequest(
    `project/${projectId}/volume/${volumeId}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );
}

export async function addAnnotations(id: number, request: string) {
  const response = await Utils.sendApiRequest(
    `volume/${id}/add-annotations`,
    {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: request,
    },
  );
  const sparseLabel: z.infer<typeof sparseLabelVolumeDataSchema> =
    await response.json();
  return sparseLabel;
}
