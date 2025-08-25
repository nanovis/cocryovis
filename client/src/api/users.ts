import {
  loginSchemaReq,
  publicUser,
  registerSchema,
  statusSchema,
  updateUserSchema,
  usersArray,
} from "#schemas/user-path-schema.mjs";
import * as Utils from "../utils/Helpers";
import z from "zod";

export async function login(request: z.input<typeof loginSchemaReq>) {
  const response = await Utils.sendRequestWithToast(
    "login",
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
    { successText: "Sign-In successful!" }
  );
  const userData: z.infer<typeof publicUser> = await response.json();
  return userData;
}

export async function logout() {
  await Utils.sendReq("logout", {
    method: "POST",
  });
}

export async function register(request: z.input<typeof registerSchema>) {
  const response = await Utils.sendRequestWithToast(
    "register",
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
    { successText: "Sign-Up successful!" }
  );
  const contents: z.infer<typeof publicUser> = await response.json();
  return contents;
}

export async function getLoggedUserData() {
  const response = await Utils.sendReq("getLoggedUserData", {
    method: "GET",
  });
  const userData: z.infer<typeof publicUser> = await response.json();
  return userData;
}

export async function getAllUsers() {
  const response = await Utils.sendReq(
    "users",
    {
      method: "GET",
    },
    false
  );
  const allUsers: z.infer<typeof usersArray> = await response.json();
  return allUsers;
}

export async function getStatus(pageNumber: number) {
  const response = await Utils.sendReq(`status?pageNumber=${pageNumber}`, {
    method: "GET",
    credentials: "include",
  });
  const contents: z.infer<typeof statusSchema> = await response.json();
  return contents;
}

export async function updateUser(request: z.input<typeof updateUserSchema>) {
  const response = await Utils.sendRequestWithToast(
    "user",
    {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
    { successText: "Change successful!" }
  );
  const contents: z.infer<typeof publicUser> = await response.json();
  return contents;
}

export async function deleteUser() {
  await Utils.sendRequestWithToast(
    "user",
    {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    },
    { successText: "Change successful!" }
  );
}

export async function AdminDeleteUser(id: number) {
  await Utils.sendRequestWithToast(
    "user-admin",
    {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id),
    },
    { successText: "Change successful!" }
  );
}
