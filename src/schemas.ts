import { z } from "zod";

const latLngSchema = z.union([
  z.object({ latitude: z.number(), longitude: z.number() }),
  z.object({ lat: z.number(), lng: z.number() }),
]);

const displayNameSchema = z.object({
  text: z.string(),
  languageCode: z.string().optional(),
});

const placeSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    displayName: displayNameSchema.optional(),
    formattedAddress: z.string().optional(),
    location: latLngSchema.optional(),
    primaryType: z.string().optional(),
    types: z.array(z.string()).optional(),
  })
  .passthrough();

export const placesSearchResponseSchema = z
  .object({
    places: z.array(placeSchema).default([]),
  })
  .passthrough();

const transitStopSchema = z
  .object({
    name: z.string().optional(),
  })
  .passthrough();

const transitLineSchema = z
  .object({
    name: z.string().optional(),
    nameShort: z.string().optional(),
    color: z.string().optional(),
    textColor: z.string().optional(),
    vehicle: z
      .object({
        type: z.string().optional(),
        name: z
          .object({
            text: z.string().optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .passthrough();

const transitStepDetailsSchema = z
  .object({
    stopDetails: z
      .object({
        departureStop: transitStopSchema.optional(),
        arrivalStop: transitStopSchema.optional(),
        departureTime: z.string().optional(),
        arrivalTime: z.string().optional(),
      })
      .optional(),
    headsign: z.string().optional(),
    tripShortText: z.string().optional(),
    stopCount: z.number().int().optional(),
    numStops: z.number().int().optional(),
    transitLine: transitLineSchema.optional(),
  })
  .passthrough();

const routeStepSchema = z
  .object({
    travelMode: z.string().optional(),
    distanceMeters: z.number().optional(),
    staticDuration: z.string().optional(),
    navigationInstruction: z
      .object({
        instructions: z.string().optional(),
      })
      .optional(),
    transitDetails: transitStepDetailsSchema.optional(),
  })
  .passthrough();

const routeLegSchema = z
  .object({
    departureTime: z.string().optional(),
    arrivalTime: z.string().optional(),
    steps: z.array(routeStepSchema).default([]),
  })
  .passthrough();

const fareSchema = z
  .object({
    currencyCode: z.string(),
    units: z.union([z.string(), z.number()]).optional(),
    nanos: z.number().optional(),
  })
  .passthrough();

const routeSchema = z
  .object({
    distanceMeters: z.number().optional(),
    duration: z.string().optional(),
    fare: fareSchema.optional(),
    legs: z.array(routeLegSchema).default([]),
  })
  .passthrough();

export const routesResponseSchema = z
  .object({
    routes: z.array(routeSchema).default([]),
  })
  .passthrough();

export type PlaceSchema = z.infer<typeof placeSchema>;
export type RouteSchema = z.infer<typeof routeSchema>;
