import { googlePost } from "./client";

import { lookupCache, writeCacheEntry } from "../cache";
import { placesSearchResponseSchema, type PlaceSchema } from "../schemas";
import type { PlaceCandidate, PlaceResolution } from "../types";

export interface SearchPlacesOptions {
  apiKey: string;
  query: string;
  fieldMask?: string;
  maxResults?: number;
  languageCode?: string;
  regionCode?: string;
}

export interface ResolvePlaceOptions {
  apiKey: string;
  query: string;
  fieldMask?: string;
  maxResults?: number;
  useCache?: boolean;
}

const PLACE_ID_PREFIX = /^placeId:\s*(.+)$/i;

export function parsePlaceIdPrefix(query: string): string | null {
  const match = PLACE_ID_PREFIX.exec(query.trim());
  const id = match?.[1]?.trim();
  return id ? id : null;
}

const PLACE_MATCH = {
  exactDisplay: 1,
  exactAddress: 0.97,
  startsDisplay: 0.92,
  startsAddress: 0.86,
  includesDisplay: 0.84,
  includesAddress: 0.8,
  fallback: 0.3,
  clearWinner: 0.96,
  closeWinner: 0.88,
  minGap: 0.12,
} as const;

function normalize(value: string): string {
  return value.normalize("NFC").trim().toLowerCase();
}

function parsePlaceId(place: PlaceSchema): string | undefined {
  if (place.id) {
    return place.id;
  }

  if (place.name && place.name.startsWith("places/")) {
    return place.name.slice("places/".length);
  }

  return undefined;
}

function parseLocation(location: PlaceSchema["location"]): PlaceCandidate["location"] | undefined {
  if (!location) {
    return undefined;
  }

  if ("latitude" in location) {
    return {
      latitude: location.latitude,
      longitude: location.longitude,
    };
  }

  return {
    latitude: location.lat,
    longitude: location.lng,
  };
}

function toPlaceCandidate(place: PlaceSchema): PlaceCandidate | null {
  const placeId = parsePlaceId(place);
  const displayName = place.displayName?.text || place.formattedAddress || place.name;
  const formattedAddress = place.formattedAddress || displayName;

  if (!placeId || !displayName || !formattedAddress) {
    return null;
  }

  return {
    placeId,
    name: place.name,
    displayName,
    formattedAddress,
    primaryType: place.primaryType,
    types: place.types ?? [],
    location: parseLocation(place.location),
  };
}

function scorePlaceMatch(query: string, place: PlaceCandidate): number {
  const normalizedDisplay = normalize(place.displayName);
  const normalizedAddress = normalize(place.formattedAddress);

  if (normalizedDisplay === query) {
    return PLACE_MATCH.exactDisplay;
  }

  if (normalizedAddress === query) {
    return PLACE_MATCH.exactAddress;
  }

  if (normalizedDisplay.startsWith(query)) {
    return PLACE_MATCH.startsDisplay;
  }

  if (normalizedAddress.startsWith(query)) {
    return PLACE_MATCH.startsAddress;
  }

  if (normalizedDisplay.includes(query)) {
    return PLACE_MATCH.includesDisplay;
  }

  if (normalizedAddress.includes(query)) {
    return PLACE_MATCH.includesAddress;
  }

  return PLACE_MATCH.fallback;
}

export async function searchPlaces(options: SearchPlacesOptions): Promise<PlaceCandidate[]> {
  const response = await googlePost<unknown>({
    service: "places",
    path: "/v1/places:searchText",
    apiKey: options.apiKey,
    fieldMask: options.fieldMask,
    body: {
      textQuery: options.query,
      pageSize: options.maxResults ?? 5,
      languageCode: options.languageCode,
      regionCode: options.regionCode,
    },
  });

  const parsed = placesSearchResponseSchema.parse(response);

  return parsed.places
    .map(toPlaceCandidate)
    .filter((place): place is PlaceCandidate => place !== null);
}

export async function tryResolvePlace(options: ResolvePlaceOptions): Promise<PlaceResolution> {
  const directId = parsePlaceIdPrefix(options.query);
  if (directId) {
    return {
      type: "found",
      place: {
        placeId: directId,
        displayName: `placeId:${directId}`,
        formattedAddress: `placeId:${directId}`,
        types: [],
      },
    };
  }

  const useCache = options.useCache !== false;
  if (useCache) {
    const cached = await lookupCache(options.query);
    if (cached) {
      return {
        type: "found",
        place: {
          placeId: cached.placeId,
          displayName: cached.displayName,
          formattedAddress: cached.formattedAddress,
          types: [],
        },
      };
    }
  }

  const places = await searchPlaces({
    apiKey: options.apiKey,
    query: options.query,
    fieldMask: options.fieldMask,
    maxResults: options.maxResults ?? 5,
  });

  if (places.length === 0) {
    return { type: "not_found" };
  }

  const normalizedQuery = normalize(options.query);
  const scored = places
    .map((place) => ({
      place,
      score: scorePlaceMatch(normalizedQuery, place),
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best) {
    return { type: "not_found" };
  }
  const second = scored[1];
  const clearWinner =
    best.score >= PLACE_MATCH.clearWinner ||
    scored.length === 1 ||
    (best.score >= PLACE_MATCH.closeWinner &&
      best.score - (second?.score ?? 0) >= PLACE_MATCH.minGap);

  if (clearWinner) {
    if (useCache) {
      await writeCacheEntry(options.query, best.place);
    }
    return {
      type: "found",
      place: best.place,
    };
  }

  return {
    type: "multiple",
    places: scored.map((entry) => entry.place),
  };
}
