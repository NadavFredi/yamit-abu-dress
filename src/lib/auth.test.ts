import { afterEach, describe, expect, it } from "vitest";

import { appConfig } from "@/lib/appConfig";
import { isAuthenticated, signIn, signOut } from "@/lib/auth";

describe("auth", () => {
  afterEach(() => {
    signOut();
  });

  it("signs in with the hard-coded credentials", () => {
    expect(signIn(appConfig.auth.username, appConfig.auth.password)).toBe(true);
    expect(isAuthenticated()).toBe(true);
  });

  it("rejects incorrect credentials", () => {
    expect(signIn(appConfig.auth.username, "wrong-password")).toBe(false);
    expect(isAuthenticated()).toBe(false);
  });
});
