const AUTH_FLAG_KEY = "yamit-abu-dress:auth";

export function isAuthenticated(): boolean {
  try {
    return sessionStorage.getItem(AUTH_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function signIn(username: string, password: string): boolean {
  const expectedUser = import.meta.env.VITE_AUTH_USER as string | undefined;
  const expectedPass = import.meta.env.VITE_AUTH_PASS as string | undefined;
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
