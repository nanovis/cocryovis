import type {
  gpuStatusSchema,
  statusSchema,
} from "@cocryovis/schemas/componentSchemas/status-schema";
import type {
  idUserSchema,
  loginSchemaReq,
  publicUser,
  registerSchema,
  statusQuery,
  updateUserSchema,
  usersArray,
} from "@cocryovis/schemas/user-path-schema";
import * as Utils from "../utils/helpers";
import type z from "zod";

export async function login(request: z.input<typeof loginSchemaReq>) {
  const response = await Utils.sendApiRequest("login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const userData = (await response.json()) as z.infer<typeof publicUser>;
  return userData;
}

export async function logout() {
  await Utils.sendApiRequest("logout", {
    method: "POST",
  });
}

export async function register(request: z.input<typeof registerSchema>) {
  const response = await Utils.sendApiRequest("register", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const contents = (await response.json()) as z.infer<typeof publicUser>;
  return contents;
}

export async function getLoggedUserData() {
  const response = await Utils.sendApiRequest("getLoggedUserData", {
    method: "GET",
  });
  const userData = (await response.json()) as z.infer<typeof publicUser>;
  return userData;
}

export async function getAllUsers() {
  const response = await Utils.sendApiRequest("users", {
    method: "GET",
  });
  const allUsers = (await response.json()) as z.infer<typeof usersArray>;
  return allUsers;
}

export async function getStatus(pageNumber: number, pageSize: number) {
  const query: z.input<typeof statusQuery> = {
    pageNumber: pageNumber.toString(),
    pageSize: pageSize.toString(),
  };
  const response = await Utils.sendApiRequest(
    `status`,
    {
      method: "GET",
      credentials: "include",
    },
    { query }
  );
  const contents = (await response.json()) as z.infer<typeof statusSchema>;
  return contents;
}

export async function getGpuStatus() {
  const response = await Utils.sendApiRequest("gpuStatus", {
    method: "GET",
    credentials: "include",
  });
  const contents = (await response.json()) as z.infer<typeof gpuStatusSchema>;
  return contents;
}

export async function updateUser(request: z.input<typeof updateUserSchema>) {
  const response = await Utils.sendApiRequest("user", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const contents = (await response.json()) as z.infer<typeof publicUser>;
  return contents;
}

export async function deleteUser() {
  await Utils.sendApiRequest("user", {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
}

export async function adminDeleteUser(user: z.input<typeof idUserSchema>) {
  await Utils.sendApiRequest("user-admin", {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });
}
