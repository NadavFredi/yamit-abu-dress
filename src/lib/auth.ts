import { appConfig } from "@/lib/appConfig";

const AUTH_FLAG_KEY = "yamit-abu-dress:auth";

export function isAuthenticated(): boolean {
  try {
    return sessionStorage.getItem(AUTH_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function signIn(username: string, password: string): boolean {
  const expectedUser = appConfig.auth.username;
  const expectedPass = appConfig.auth.password;
  if (!expectedUser || !expectedPass) return false;
  if (username !== expectedUser || password !== expectedPass) return false;
  try {
    sessionStorage.setItem(AUTH_FLAG_KEY, "1");
  } catch {
    return false;
  }
  return true;
}

export function signOut(): void {
  try {
    sessionStorage.removeItem(AUTH_FLAG_KEY);
  } catch {
    // ignore
  }
}
