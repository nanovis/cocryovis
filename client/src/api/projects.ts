import type { projectSchema } from "#schemas/componentSchemas/project-schema";
import type {
  projectAccessInfoSchema,
  projectCreateSchemaReq,
  projectSchemaDeepRes,
  projectsSchemaDeepRes,
  setAccessSchemaReq,
  setAccessSchemaRes,
} from "#schemas/project-path-schema";
import * as Utils from "../utils/helpers";
import type z from "zod";

export async function getAllUserProjectsDeep() {
  const response = await Utils.sendApiRequest("projects-deep", {
    method: "GET",
  });
  const projects: z.infer<typeof projectsSchemaDeepRes> = await response.json();
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
  const project: z.infer<typeof projectSchema> = await response.json();
  return project;
}

export async function getAccessInfo(id: number) {
  const response = await Utils.sendApiRequest(`project/${id}/access`, {
    method: "GET",
  });
  const accessInfo: z.infer<typeof projectAccessInfoSchema> =
    await response.json();
  return accessInfo;
}

export async function getProjectDeep(id: number) {
  const response = await Utils.sendApiRequest(`project/${id}/deep`, {
    method: "GET",
  });
  const project: z.infer<typeof projectSchemaDeepRes> = await response.json();
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
  const accessInfoChanges: z.infer<typeof setAccessSchemaRes> =
    await response.json();
  return accessInfoChanges;
}

export async function deleteProject(id: number) {
  await Utils.sendApiRequest(`project/${id}`, {
    method: "DELETE",
  });
}
