import { appConfig } from "@/lib/appConfig";

const AUTH_FLAG_KEY = "yamit-abu-dress:auth";

function getBrowserStorage(name: "localStorage" | "sessionStorage"): Storage | null {
  try {
    const storage = globalThis.window?.[name] ?? globalThis[name];
    if (
      !storage ||
      typeof storage.getItem !== "function" ||
      typeof storage.setItem !== "function" ||
      typeof storage.removeItem !== "function"
    ) {
      return null;
    }
    return storage;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  const local = getBrowserStorage("localStorage");
  const session = getBrowserStorage("sessionStorage");
  return (
    local?.getItem(AUTH_FLAG_KEY) === "1" ||
    session?.getItem(AUTH_FLAG_KEY) === "1"
  );
}

export function signIn(username: string, password: string): boolean {
  const expectedUser = appConfig.auth.username;
  const expectedPass = appConfig.auth.password;
  if (!expectedUser || !expectedPass) return false;
  if (username !== expectedUser || password !== expectedPass) return false;
  const storage =
    getBrowserStorage("localStorage") ?? getBrowserStorage("sessionStorage");
  if (!storage) return false;
  try {
    storage.setItem(AUTH_FLAG_KEY, "1");
  } catch {
    return false;
  }
  return true;
}

export function signOut(): void {
  for (const storage of [
    getBrowserStorage("localStorage"),
    getBrowserStorage("sessionStorage"),
  ]) {
    try {
      storage?.removeItem(AUTH_FLAG_KEY);
    } catch {
      // ignore
    }
  }
}
