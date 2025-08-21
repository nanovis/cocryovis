import z from "zod";
import * as Utils from "../utils/Helpers";
import {
  createVolumeReq,
  getVolumeSchema,
  volumesDeepSchemaRes,
} from "#schemas/volume-path-schema.mjs";
import { volumeSchema } from "#schemas/componentSchemas/volume-schema.mjs";
import { sparseLabelVolumeDataSchema } from "#schemas/componentSchemas/sparse-label-volume-data-schema.mjs";

export async function getVolumesFromProjectDeep(id: number) {
  const response = await Utils.sendReq(`project/${id}/volumes/deep`, {
    method: "GET",
    credentials: "include",
  });
  const volumes: z.infer<typeof volumesDeepSchemaRes> = await response.json();
  return volumes;
}

export async function createVolume(
  id: number,
  request: z.infer<typeof createVolumeReq>
) {
  const response = await Utils.sendReq(`project/${id}/volumes`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const volume: z.infer<typeof volumeSchema> = await response.json();
  return volume;
}

export async function getVolumeWithSparseVolumes(Id: number) {
  const response = await Utils.sendReq(
    `/volume/${Id}?sparseVolumes=true`,
    {
      method: "GET",
    },
    false
  );
  const volume: z.infer<typeof getVolumeSchema> = await response.json();
  return volume;
}

export async function removeFromProject(projectId: number, volumeId: number) {
  await Utils.sendRequestWithToast(
    `project/${projectId}/volume/${volumeId}`,
    {
      method: "DELETE",
      credentials: "include",
    },
    { successText: "Volume Successfuly Removed From Project" }
  );
}

export async function addAnnotations(id: number, request: string) {
  const response = await Utils.sendReq(
    `volume/${id}/add-annotations`,
    {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: request,
    },
    false
  );
  const sparseLabel: z.infer<typeof sparseLabelVolumeDataSchema> =
    await response.json();
  return sparseLabel;
}
