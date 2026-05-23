import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { mutateHomeConfig, readRawConfig, resolveAlias, writeWaygoConfig } from "./config";

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

describe("readRawConfig", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "waygo-test-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns undefined when file is missing", async () => {
    expect(await readRawConfig(join(dir, "missing.json"))).toBeUndefined();
  });

  it("returns parsed JSON when file exists", async () => {
    const path = join(dir, "config.json");
    await writeFile(path, JSON.stringify({ googleMapsApiKey: "abc", aliases: { home: "x" } }));
    expect(await readRawConfig(path)).toEqual({ googleMapsApiKey: "abc", aliases: { home: "x" } });
  });

  it("throws WaygoConfigError on invalid JSON", async () => {
    const path = join(dir, "config.json");
    await writeFile(path, "{ not json");
    await expect(readRawConfig(path)).rejects.toThrow(/Failed to parse/);
  });
});

describe("mutateHomeConfig", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "waygo-test-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("seeds an empty config when file is missing", async () => {
    const path = join(dir, "config.json");
    const next = await mutateHomeConfig(
      (cfg) => ({ ...cfg, aliases: { ...cfg.aliases, home: "X" } }),
      path,
    );
    expect(next.aliases).toEqual({ home: "X" });
    expect(await readRawConfig(path)).toEqual({ aliases: { home: "X" } });
  });

  it("preserves other fields", async () => {
    const path = join(dir, "config.json");
    await writeWaygoConfig({ googleMapsApiKey: "key", placeSearchLimit: 7 }, path);
    await mutateHomeConfig(
      (cfg) => ({ ...cfg, aliases: { ...cfg.aliases, home: "X" } }),
      path,
    );
    const result = await readRawConfig(path);
    expect(result?.googleMapsApiKey).toBe("key");
    expect(result?.placeSearchLimit).toBe(7);
    expect(result?.aliases?.home).toBe("X");
  });
});
