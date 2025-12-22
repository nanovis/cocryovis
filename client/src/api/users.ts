import type {
  idUserSchema,
  loginSchemaReq,
  publicUser,
  registerSchema,
  statusQuery,
  statusSchema,
  updateUserSchema,
  usersArray,
} from "#schemas/user-path-schema.mjs";
import * as Utils from "../utils/Helpers";
import type z from "zod";

export async function login(request: z.input<typeof loginSchemaReq>) {
  const response = await Utils.sendApiRequest("login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const userData: z.infer<typeof publicUser> = await response.json();
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
  const contents: z.infer<typeof publicUser> = await response.json();
  return contents;
}

export async function getLoggedUserData() {
  const response = await Utils.sendApiRequest("getLoggedUserData", {
    method: "GET",
  });
  const userData: z.infer<typeof publicUser> = await response.json();
  return userData;
}

export async function getAllUsers() {
  const response = await Utils.sendApiRequest("users", {
    method: "GET",
  });
  const allUsers: z.infer<typeof usersArray> = await response.json();
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
  const contents: z.infer<typeof statusSchema> = await response.json();
  return contents;
}

export async function updateUser(request: z.input<typeof updateUserSchema>) {
  const response = await Utils.sendApiRequest("user", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const contents: z.infer<typeof publicUser> = await response.json();
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
