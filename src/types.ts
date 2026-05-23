export type TripPreference = "less-walking" | "fewer-transfers";

export interface WaygoConfig {
  googleMapsApiKey?: string;
  aliases?: Record<string, string>;
  placeSearchLimit?: number;
  placesFieldMask?: string;
  routesFieldMask?: string;
}

export interface LoadedWaygoConfig {
  apiKey: string;
  aliases: Record<string, string>;
  placeSearchLimit: number;
  placesFieldMask: string;
  routesFieldMask: string;
}

export interface PlaceCandidate {
  name?: string;
  placeId: string;
  displayName: string;
  formattedAddress: string;
  primaryType?: string;
  types: string[];
  location?: {
    latitude: number;
    longitude: number;
  };
}

export type PlaceResolution =
  | {
      type: "found";
      place: PlaceCandidate;
    }
  | {
      type: "multiple";
      places: PlaceCandidate[];
    }
  | {
      type: "not_found";
    };

export interface JsonTransitStep {
  type: "transit";
  departureTime?: string;
  arrivalTime?: string;
  departureStop?: string;
  arrivalStop?: string;
  headsign?: string;
  lineName?: string;
  lineShortName?: string;
  tripShortText?: string;
  lineColor?: string;
  lineTextColor?: string;
  vehicleType?: string;
  vehicleName?: string;
  stopCount?: number;
  durationSeconds?: number;
  distanceMeters?: number;
}

interface JsonWalkStep {
  type: "walk";
  instruction?: string;
  durationSeconds?: number;
  distanceMeters?: number;
}

export type JsonTripStep = JsonTransitStep | JsonWalkStep;

export interface JsonTripLeg {
  departureTime?: string;
  arrivalTime?: string;
  steps: JsonTripStep[];
}

export interface JsonFare {
  currencyCode: string;
  amount: number;
}

export interface JsonTripRoute {
  index: number;
  durationSeconds?: number;
  distanceMeters?: number;
  fare?: JsonFare;
  legs: JsonTripLeg[];
}

export interface JsonPlacesOutput {
  query: string;
  places: PlaceCandidate[];
}
