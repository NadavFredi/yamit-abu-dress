import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("flex", "items-center")).toBe("flex items-center");
  });

  it("drops falsy conditional class names", () => {
    expect(cn("base", false && "hidden", null, undefined, "visible")).toBe(
      "base visible"
    );
  });

  it("merges conflicting Tailwind classes with the latter class winning", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });
});
