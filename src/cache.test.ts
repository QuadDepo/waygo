import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearCache, lookupCache, normalizeCacheKey, writeCacheEntry } from "./cache";

let dir: string;
let path: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "waygo-cache-test-"));
  path = join(dir, "cache.json");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("normalizeCacheKey", () => {
  it("lowercases and trims", () => {
    expect(normalizeCacheKey("  Amsterdam Centraal  ")).toBe("amsterdam centraal");
  });

  it("preserves internal whitespace", () => {
    expect(normalizeCacheKey("Coffee in Utrecht")).toBe("coffee in utrecht");
  });
});

describe("lookupCache", () => {
  it("returns undefined when file is missing", async () => {
    expect(await lookupCache("foo", path)).toBeUndefined();
  });

  it("returns undefined for a miss", async () => {
    await writeCacheEntry(
      "Amsterdam Centraal",
      {
        placeId: "ChIJ123",
        displayName: "Amsterdam Centraal",
        formattedAddress: "Stationsplein, Amsterdam",
        types: [],
      },
      path,
    );
    expect(await lookupCache("Schiphol Airport", path)).toBeUndefined();
  });

  it("returns a hit for the same query, case-insensitively", async () => {
    await writeCacheEntry(
      "Amsterdam Centraal",
      {
        placeId: "ChIJ123",
        displayName: "Amsterdam Centraal",
        formattedAddress: "Stationsplein, Amsterdam",
        types: [],
      },
      path,
    );
    const hit = await lookupCache("amsterdam CENTRAAL", path);
    expect(hit?.placeId).toBe("ChIJ123");
    expect(hit?.cachedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns undefined for a corrupted file", async () => {
    await writeFile(path, "{ not json");
    expect(await lookupCache("anything", path)).toBeUndefined();
  });

  it("returns undefined for an unknown cache version", async () => {
    await writeFile(path, JSON.stringify({ version: 99, entries: { foo: {} } }));
    expect(await lookupCache("foo", path)).toBeUndefined();
  });
});

describe("writeCacheEntry", () => {
  it("writes mode 0600", async () => {
    await writeCacheEntry(
      "Q",
      {
        placeId: "ChIJ1",
        displayName: "Q",
        formattedAddress: "Q",
        types: [],
      },
      path,
    );

    if (process.platform !== "win32") {
      const info = await stat(path);
      // eslint-disable-next-line no-bitwise
      expect(info.mode & 0o777).toBe(0o600);
    }
  });

  it("merges multiple entries", async () => {
    await writeCacheEntry(
      "A",
      { placeId: "1", displayName: "A", formattedAddress: "A", types: [] },
      path,
    );
    await writeCacheEntry(
      "B",
      { placeId: "2", displayName: "B", formattedAddress: "B", types: [] },
      path,
    );
    const parsed = JSON.parse(await readFile(path, "utf8"));
    expect(Object.keys(parsed.entries)).toEqual(["a", "b"]);
  });

  it("overwrites the same key", async () => {
    await writeCacheEntry(
      "A",
      { placeId: "1", displayName: "A", formattedAddress: "A", types: [] },
      path,
    );
    await writeCacheEntry(
      "A",
      { placeId: "9", displayName: "A2", formattedAddress: "A2", types: [] },
      path,
    );
    const hit = await lookupCache("a", path);
    expect(hit?.placeId).toBe("9");
  });
});

describe("clearCache", () => {
  it("removes the file and returns true when it existed", async () => {
    await writeCacheEntry(
      "A",
      { placeId: "1", displayName: "A", formattedAddress: "A", types: [] },
      path,
    );
    expect(await clearCache(path)).toBe(true);
    expect(await lookupCache("A", path)).toBeUndefined();
  });

  it("returns false when there was nothing to clear", async () => {
    expect(await clearCache(path)).toBe(false);
  });
});
