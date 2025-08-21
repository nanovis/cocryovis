import { projectSchema } from "#schemas/componentSchemas/project-schema.mjs";
import {
  projectAccessInfoSchema,
  projectCreateSchemaReq,
  projectSchemaDeepRes,
  projectsSchemaDeepRes,
  setAccessSchemaReq,
  setAccessSchemaRes,
} from "#schemas/project-path-schema.mjs";
import * as Utils from "../utils/Helpers";
import z from "zod";

export async function getAllUserProjectsDeep() {
  const response = await Utils.sendReq("projects-deep", {
    method: "GET",
  });
  const projects: z.infer<typeof projectsSchemaDeepRes> = await response.json();
  return projects;
}

export async function createProject(
  request: z.infer<typeof projectCreateSchemaReq>
) {
  const response = await Utils.sendRequestWithToast("projects", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const project: z.infer<typeof projectSchema> = await response.json();
  return project;
}

export async function getAccessInfo(id: number) {
  const response = await Utils.sendReq(
    `project/${id}/access`,
    {
      method: "GET",
    },
    false
  );
  const accessInfo: z.infer<typeof projectAccessInfoSchema> =
    await response.json();
  return accessInfo;
}

export async function getProjectDeep(id: number) {
  const response = await Utils.sendReq(`project/${id}/deep`, {
    method: "GET",
  });
  const project: z.infer<typeof projectSchemaDeepRes> =
    await response.json();
  return project;
}

export async function setAccess(
  id: number,
  request: z.infer<typeof setAccessSchemaReq>
) {
  const response = await Utils.sendReq(
    `project/${id}/access`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
    false
  );
  const accessInfoChanges: z.infer<typeof setAccessSchemaRes> =
    await response.json();
  return accessInfoChanges;
}

export async function deleteProject(id: number) {
  await Utils.sendRequestWithToast(`project/${id}`, {
    method: "DELETE",
  });
}
