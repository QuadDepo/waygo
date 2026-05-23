import { afterEach, describe, expect, it, vi } from "vitest";

import { colorizeBadge, colorizeForeground, vehicleFallbackColors, vehicleLabel } from "./vehicle";

describe("vehicleLabel", () => {
  it.each([
    [undefined, "TRANSIT"],
    ["BUS", "BUS"],
    ["INTERCITY_BUS", "BUS"],
    ["HEAVY_RAIL", "RAIL"],
    ["HIGH_SPEED_TRAIN", "HSR"],
    ["UNKNOWN_VEHICLE", "UNKNOWN_VEHICLE"],
  ])("labels %s as %s", (input, expected) => {
    expect(vehicleLabel(input)).toBe(expected);
  });
});

describe("vehicleFallbackColors", () => {
  it("returns colors for known type", () => {
    expect(vehicleFallbackColors("BUS")).toEqual({ bg: "#2E7D32", fg: "#FFFFFF" });
  });

  it("returns undefined for unknown", () => {
    expect(vehicleFallbackColors("WHATEVER")).toBeUndefined();
    expect(vehicleFallbackColors(undefined)).toBeUndefined();
  });
});

describe("color helpers", () => {
  const originalIsTTY = process.stdout.isTTY;
  const originalNoColor = process.env.NO_COLOR;

  afterEach(() => {
    Object.defineProperty(process.stdout, "isTTY", { value: originalIsTTY, configurable: true });
    if (originalNoColor === undefined) {
      delete process.env.NO_COLOR;
    } else {
      process.env.NO_COLOR = originalNoColor;
    }
    vi.restoreAllMocks();
  });

  function setTty(value: boolean) {
    Object.defineProperty(process.stdout, "isTTY", { value, configurable: true });
  }

  it("returns plain text when not a TTY", () => {
    setTty(false);
    delete process.env.NO_COLOR;
    expect(colorizeForeground("hi", "#FF0000")).toBe("hi");
    expect(colorizeBadge("hi", { backgroundColor: "#FF0000" })).toBe("hi");
  });

  it("respects NO_COLOR", () => {
    setTty(true);
    process.env.NO_COLOR = "1";
    expect(colorizeForeground("hi", "#FF0000")).toBe("hi");
  });

  it("emits ANSI escapes in a TTY without NO_COLOR", () => {
    setTty(true);
    delete process.env.NO_COLOR;
    const out = colorizeForeground("hi", "#FF0000");
    expect(out).toContain("[38;2;255;0;0m");
    expect(out).toContain("hi");
    expect(out).toContain("[0m");
  });

  it("ignores invalid hex", () => {
    setTty(true);
    delete process.env.NO_COLOR;
    expect(colorizeForeground("hi", "nope")).toBe("hi");
  });
});
