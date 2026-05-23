import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { PlaceCandidate } from "./types";

const CACHE_DIR = join(homedir(), ".config", "waygo");
export const CACHE_FILE = join(CACHE_DIR, "cache.json");
const CACHE_VERSION = 1;

export interface CacheEntry {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  cachedAt: string;
}

interface CacheFile {
  version: number;
  entries: Record<string, CacheEntry>;
}

export function normalizeCacheKey(query: string): string {
  return query.normalize("NFC").trim().toLowerCase();
}

async function readCacheFile(path: string = CACHE_FILE): Promise<CacheFile> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: CACHE_VERSION, entries: {} };
    }
    throw error;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CacheFile>;
    if (parsed.version !== CACHE_VERSION || !parsed.entries) {
      return { version: CACHE_VERSION, entries: {} };
    }
    return { version: parsed.version, entries: parsed.entries };
  } catch {
    return { version: CACHE_VERSION, entries: {} };
  }
}

async function writeCacheFile(file: CacheFile, path: string = CACHE_FILE): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
}

export async function lookupCache(
  query: string,
  path: string = CACHE_FILE,
): Promise<CacheEntry | undefined> {
  const file = await readCacheFile(path);
  return file.entries[normalizeCacheKey(query)];
}

export async function writeCacheEntry(
  query: string,
  place: PlaceCandidate,
  path: string = CACHE_FILE,
): Promise<void> {
  const file = await readCacheFile(path);
  file.entries[normalizeCacheKey(query)] = {
    placeId: place.placeId,
    displayName: place.displayName,
    formattedAddress: place.formattedAddress,
    cachedAt: new Date().toISOString(),
  };
  await writeCacheFile(file, path);
}

export async function clearCache(path: string = CACHE_FILE): Promise<boolean> {
  try {
    await rm(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}
