import type { projectSchema } from "@cocryovis/schemas/componentSchemas/project-schema";
import type {
  projectAccessInfoSchema,
  projectCreateSchemaReq,
  projectSchemaDeepRes,
  projectsSchemaDeepRes,
  setAccessSchemaReq,
  setAccessSchemaRes,
} from "@cocryovis/schemas/project-path-schema";
import * as Utils from "../utils/helpers";
import type z from "zod";

export async function getAllUserProjectsDeep() {
  const response = await Utils.sendApiRequest("projects-deep", {
    method: "GET",
  });
  const projects = (await response.json()) as z.infer<
    typeof projectsSchemaDeepRes
  >;
  return projects;
}

export async function createProject(
  request: z.input<typeof projectCreateSchemaReq>
) {
  const response = await Utils.sendApiRequest("projects", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const project = (await response.json()) as z.infer<typeof projectSchema>;
  return project;
}

export async function getAccessInfo(id: number) {
  const response = await Utils.sendApiRequest(`project/${id}/access`, {
    method: "GET",
  });
  const accessInfo = (await response.json()) as z.infer<
    typeof projectAccessInfoSchema
  >;
  return accessInfo;
}

export async function getProjectDeep(id: number) {
  const response = await Utils.sendApiRequest(`project/${id}/deep`, {
    method: "GET",
  });
  const project = (await response.json()) as z.infer<
    typeof projectSchemaDeepRes
  >;
  return project;
}

export async function setAccess(
  id: number,
  request: z.input<typeof setAccessSchemaReq>
) {
  const response = await Utils.sendApiRequest(`project/${id}/access`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const accessInfoChanges = (await response.json()) as z.infer<
    typeof setAccessSchemaRes
  >;
  return accessInfoChanges;
}

export async function deleteProject(id: number) {
  await Utils.sendApiRequest(`project/${id}`, {
    method: "DELETE",
  });
}
