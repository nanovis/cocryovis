import type { UserDB } from "@/stores/userState/UserModel";
import Cookies from "js-cookie";

type UserCookieData = UserDB;

const UserCookieName = "LoggedUser";
const expiresInDays = 7;

export function setUserCookie(userData: UserCookieData) {
  const cookieOptions = {
    expires: expiresInDays,
    secure: true,
    sameSite: "strict" as const,
  };
  Cookies.set(UserCookieName, JSON.stringify(userData), cookieOptions);
}

export function removeUserCookie() {
  Cookies.remove(UserCookieName);
}

export function getUserCookie(): UserCookieData | null {
  const cookieData = Cookies.get(UserCookieName);
  if (!cookieData) {
    return null;
  }
  try {
    return JSON.parse(cookieData) as UserCookieData;
  } catch (error) {
    console.error("Failed to parse user cookie:", error);
    return null;
  }
}
