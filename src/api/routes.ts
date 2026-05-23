import { googlePost } from "./client";

import { routesResponseSchema, type RouteSchema } from "../schemas";
import type { TripPreference } from "../types";

interface RouteLocationInput {
  placeId?: string;
  address?: string;
}

export interface FetchTransitRoutesOptions {
  apiKey: string;
  origin: RouteLocationInput;
  destination: RouteLocationInput;
  departureTime?: string;
  arrivalTime?: string;
  preference?: TripPreference;
  fieldMask?: string;
  transitAllowedTravelModes?: string[];
}

const TRANSIT_ROUTING_PREFERENCE: Record<TripPreference, string> = {
  "fewer-transfers": "FEWER_TRANSFERS",
  "less-walking": "LESS_WALKING",
};
const FALLBACK_ROUTES_FIELD_MASK = [
  "routes.distanceMeters",
  "routes.duration",
  "routes.legs.steps.travelMode",
  "routes.legs.steps.distanceMeters",
  "routes.legs.steps.staticDuration",
  "routes.legs.steps.navigationInstruction.instructions",
  "routes.legs.steps.transitDetails",
].join(",");

function toWaypoint(input: RouteLocationInput): { placeId?: string; address?: string } {
  if (input.placeId) {
    return { placeId: input.placeId };
  }

  if (input.address) {
    return { address: input.address };
  }

  throw new Error("Origin and destination must provide placeId or address");
}

export async function fetchTransitRoutes(
  options: FetchTransitRoutesOptions,
): Promise<RouteSchema[]> {
  const transitPreferences: Record<string, unknown> = {};

  if (options.preference) {
    transitPreferences.routingPreference = TRANSIT_ROUTING_PREFERENCE[options.preference];
  }

  if (options.transitAllowedTravelModes && options.transitAllowedTravelModes.length > 0) {
    transitPreferences.allowedTravelModes = options.transitAllowedTravelModes;
  }

  const requestBody: Record<string, unknown> = {
    origin: toWaypoint(options.origin),
    destination: toWaypoint(options.destination),
    travelMode: "TRANSIT",
    computeAlternativeRoutes: true,
    departureTime: options.departureTime,
    arrivalTime: options.arrivalTime,
    ...(Object.keys(transitPreferences).length > 0 ? { transitPreferences } : {}),
  };

  const request = {
    service: "routes",
    path: "/directions/v2:computeRoutes",
    apiKey: options.apiKey,
    fieldMask: options.fieldMask,
    body: requestBody,
  } as const;

  let response: unknown;
  try {
    response = await googlePost<unknown>(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const maskLooksInvalid =
      message.includes("Error expanding 'fields' parameter") || message.includes("FieldMask");

    if (options.fieldMask && maskLooksInvalid) {
      response = await googlePost<unknown>({
        ...request,
        fieldMask: FALLBACK_ROUTES_FIELD_MASK,
      });
    } else {
      throw error;
    }
  }

  const parsed = routesResponseSchema.parse(response);
  return parsed.routes;
}
