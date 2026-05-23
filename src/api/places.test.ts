import { describe, expect, it } from "vitest";

import { parsePlaceIdPrefix } from "./places";

describe("parsePlaceIdPrefix", () => {
  it("extracts the id from a placeId: prefix", () => {
    expect(parsePlaceIdPrefix("placeId:ChIJWdNZK39JxkcRzpkScTcc2RM")).toBe(
      "ChIJWdNZK39JxkcRzpkScTcc2RM",
    );
  });

  it("is case-insensitive on the prefix", () => {
    expect(parsePlaceIdPrefix("PLACEID:ChIJ123")).toBe("ChIJ123");
    expect(parsePlaceIdPrefix("PlaceID:ChIJ123")).toBe("ChIJ123");
  });

  it("tolerates whitespace", () => {
    expect(parsePlaceIdPrefix("  placeId: ChIJ123  ")).toBe("ChIJ123");
  });

  it("returns null for non-prefix input", () => {
    expect(parsePlaceIdPrefix("Amsterdam Centraal")).toBeNull();
    expect(parsePlaceIdPrefix("place:ChIJ123")).toBeNull();
    expect(parsePlaceIdPrefix("")).toBeNull();
    expect(parsePlaceIdPrefix("placeId:")).toBeNull();
    expect(parsePlaceIdPrefix("placeId:   ")).toBeNull();
  });
});
