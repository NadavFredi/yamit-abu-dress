import { afterEach, describe, expect, it } from "vitest";

import { appConfig } from "@/lib/appConfig";
import { isAuthenticated, signIn, signOut } from "@/lib/auth";

describe("auth", () => {
  afterEach(() => {
    signOut();
  });

  it("signs in with the configured credentials and persists the login", () => {
    expect(signIn(appConfig.auth.username, appConfig.auth.password)).toBe(true);
    expect(isAuthenticated()).toBe(true);
    expect(window.localStorage.getItem("yamit-abu-dress:auth")).toBe("1");
  });

  it("rejects incorrect credentials", () => {
    expect(signIn(appConfig.auth.username, "wrong-password")).toBe(false);
    expect(isAuthenticated()).toBe(false);
  });

  it("uses YamitDress as the login username", () => {
    expect(appConfig.auth.username).toBe("YamitDress");
    expect(signIn("order", appConfig.auth.password)).toBe(false);
    expect(signIn("YamitDress", appConfig.auth.password)).toBe(true);
  });
});
