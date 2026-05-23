import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { loadConfig } from "c12";

import { WaygoConfigError } from "./errors";
import type { LoadedWaygoConfig, WaygoConfig } from "./types";

const DEFAULT_PLACE_SEARCH_LIMIT = 5;
const HOME_CONFIG_DIR = join(homedir(), ".config", "waygo");
export const HOME_CONFIG_FILE = join(HOME_CONFIG_DIR, "config.json");
const HOME_CONFIG_BASENAME = join(HOME_CONFIG_DIR, "config");

const DEFAULT_PLACES_FIELD_MASK = [
  "places.id",
  "places.name",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.primaryType",
  "places.types",
].join(",");

const DEFAULT_ROUTES_FIELD_MASK = [
  "routes.distanceMeters",
  "routes.duration",
  "routes.legs.steps.travelMode",
  "routes.legs.steps.distanceMeters",
  "routes.legs.steps.staticDuration",
  "routes.legs.steps.navigationInstruction.instructions",
  "routes.legs.steps.transitDetails",
].join(",");

export async function loadWaygoConfig(): Promise<LoadedWaygoConfig> {
  const resolved = await loadConfig<WaygoConfig>({
    name: "waygo",
    configFile: HOME_CONFIG_BASENAME,
    globalRc: true,
    dotenv: true,
    defaults: {
      aliases: {},
      placeSearchLimit: DEFAULT_PLACE_SEARCH_LIMIT,
      placesFieldMask: DEFAULT_PLACES_FIELD_MASK,
      routesFieldMask: DEFAULT_ROUTES_FIELD_MASK,
    },
  });

  const config = resolved.config ?? {};
  const apiKey = config.googleMapsApiKey?.trim() || process.env.GOOGLE_MAPS_API_KEY?.trim() || "";

  if (!apiKey) {
    throw new WaygoConfigError("Missing Google Maps API key.", {
      hint: "Set GOOGLE_MAPS_API_KEY in your environment or run `waygo init` to write ~/.config/waygo/config.json.",
    });
  }

  return {
    apiKey,
    aliases: config.aliases ?? {},
    placeSearchLimit: config.placeSearchLimit ?? DEFAULT_PLACE_SEARCH_LIMIT,
    placesFieldMask: config.placesFieldMask?.trim() || DEFAULT_PLACES_FIELD_MASK,
    routesFieldMask: config.routesFieldMask?.trim() || DEFAULT_ROUTES_FIELD_MASK,
  };
}

export async function writeWaygoConfig(
  config: WaygoConfig,
  path: string = HOME_CONFIG_FILE,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
}

export async function readRawConfig(
  path: string = HOME_CONFIG_FILE,
): Promise<WaygoConfig | undefined> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }

  try {
    return JSON.parse(raw) as WaygoConfig;
  } catch (error) {
    throw new WaygoConfigError(`Failed to parse ${path}.`, {
      hint: "The config file is not valid JSON. Fix it or delete it and re-run `waygo init`.",
      cause: error,
    });
  }
}

export async function mutateHomeConfig(
  mutate: (config: WaygoConfig) => WaygoConfig,
  path: string = HOME_CONFIG_FILE,
): Promise<WaygoConfig> {
  const current = (await readRawConfig(path)) ?? {};
  const next = mutate(current);
  await writeWaygoConfig(next, path);
  return next;
}

export function resolveAlias(input: string, aliases: Record<string, string>): string {
  if (aliases[input]) {
    return aliases[input];
  }

  const loweredInput = input.toLowerCase();
  const entry = Object.entries(aliases).find(([alias]) => alias.toLowerCase() === loweredInput);

  return entry?.[1] ?? input;
}
