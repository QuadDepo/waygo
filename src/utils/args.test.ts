import { describe, expect, it } from "vitest";

import { getArgString } from "./args";

describe("getArgString", () => {
  it("returns trimmed strings", () => {
    expect(getArgString("  hello  ")).toBe("hello");
  });

  it("returns undefined for empty / whitespace", () => {
    expect(getArgString("")).toBeUndefined();
    expect(getArgString("   ")).toBeUndefined();
  });

  it("returns undefined for non-strings", () => {
    expect(getArgString(undefined)).toBeUndefined();
    expect(getArgString(123)).toBeUndefined();
    expect(getArgString(true)).toBeUndefined();
    expect(getArgString(null)).toBeUndefined();
  });
});
