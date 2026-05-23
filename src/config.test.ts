import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveAlias, writeWaygoConfig } from "./config";

describe("resolveAlias", () => {
  const aliases = { home: "1600 Amphitheatre Pkwy", Work: "350 Bush St" };

  it("returns alias value for exact key", () => {
    expect(resolveAlias("home", aliases)).toBe("1600 Amphitheatre Pkwy");
  });

  it("is case-insensitive", () => {
    expect(resolveAlias("HOME", aliases)).toBe("1600 Amphitheatre Pkwy");
    expect(resolveAlias("work", aliases)).toBe("350 Bush St");
  });

  it("returns input when no alias matches", () => {
    expect(resolveAlias("Eiffel Tower", aliases)).toBe("Eiffel Tower");
  });

  it("handles empty aliases", () => {
    expect(resolveAlias("anything", {})).toBe("anything");
  });
});

describe("writeWaygoConfig", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "waygo-test-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes JSON and sets mode 0600", async () => {
    const path = join(dir, "nested", "config.json");
    await writeWaygoConfig({ googleMapsApiKey: "abc123" }, path);
    const content = JSON.parse(await readFile(path, "utf8"));
    expect(content).toEqual({ googleMapsApiKey: "abc123" });

    if (process.platform !== "win32") {
      const info = await stat(path);
      // eslint-disable-next-line no-bitwise
      expect(info.mode & 0o777).toBe(0o600);
    }
  });
});
