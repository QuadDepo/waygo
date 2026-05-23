import { describe, expect, it } from "vitest";

import { placesSearchResponseSchema, routesResponseSchema } from "./schemas";

describe("placesSearchResponseSchema", () => {
  it("defaults places to empty array when absent", () => {
    expect(placesSearchResponseSchema.parse({})).toEqual({ places: [] });
  });

  it("preserves passthrough fields", () => {
    const parsed = placesSearchResponseSchema.parse({
      places: [{ id: "abc", extraField: "kept" }],
    });
    expect(parsed.places[0]).toMatchObject({ id: "abc", extraField: "kept" });
  });

  it("accepts both lat/lng and latitude/longitude locations", () => {
    const parsed = placesSearchResponseSchema.parse({
      places: [
        { id: "a", location: { lat: 1, lng: 2 } },
        { id: "b", location: { latitude: 3, longitude: 4 } },
      ],
    });
    expect(parsed.places).toHaveLength(2);
  });
});

describe("routesResponseSchema", () => {
  it("defaults routes and legs to []", () => {
    expect(routesResponseSchema.parse({})).toEqual({ routes: [] });
    const parsed = routesResponseSchema.parse({ routes: [{ duration: "60s" }] });
    expect(parsed.routes[0]).toMatchObject({ duration: "60s", legs: [] });
  });

  it("accepts fare units as string or number", () => {
    const a = routesResponseSchema.parse({
      routes: [{ fare: { currencyCode: "EUR", units: "12", nanos: 500_000_000 } }],
    });
    const b = routesResponseSchema.parse({
      routes: [{ fare: { currencyCode: "EUR", units: 12 } }],
    });
    expect(a.routes[0]?.fare?.units).toBe("12");
    expect(b.routes[0]?.fare?.units).toBe(12);
  });
});
