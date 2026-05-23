import { describe, expect, it } from "vitest";

import {
  WaygoApiError,
  WaygoCancelledError,
  WaygoConfigError,
  WaygoError,
  WaygoInputError,
  hintForApiError,
  hintForApiStatus,
} from "./errors";

describe("WaygoError hierarchy", () => {
  it("preserves message, hint, cause, and name", () => {
    const cause = new Error("boom");
    const err = new WaygoError("nope", { hint: "try again", cause });
    expect(err.message).toBe("nope");
    expect(err.hint).toBe("try again");
    expect(err.cause).toBe(cause);
    expect(err.name).toBe("WaygoError");
    expect(err).toBeInstanceOf(Error);
  });

  it("subclasses set their own name", () => {
    expect(new WaygoConfigError("x").name).toBe("WaygoConfigError");
    expect(new WaygoCancelledError().name).toBe("WaygoCancelledError");
    expect(new WaygoInputError("x").name).toBe("WaygoInputError");
    expect(new WaygoApiError("x", { service: "places" }).name).toBe("WaygoApiError");
  });

  it("WaygoCancelledError defaults to 'Cancelled.'", () => {
    expect(new WaygoCancelledError().message).toBe("Cancelled.");
  });

  it("WaygoApiError carries service and status", () => {
    const err = new WaygoApiError("oops", { service: "routes", status: 429 });
    expect(err.service).toBe("routes");
    expect(err.status).toBe(429);
  });
});

describe("hintForApiStatus", () => {
  it.each([
    [401, /GOOGLE_MAPS_API_KEY/],
    [403, /GOOGLE_MAPS_API_KEY/],
    [429, /rate-limited/],
    [400, /rejected/],
    [500, /server error/],
    [503, /server error/],
  ])("returns hint for %i", (status, matcher) => {
    expect(hintForApiStatus(status)).toMatch(matcher);
  });

  it("returns undefined for unknown statuses", () => {
    expect(hintForApiStatus(undefined)).toBeUndefined();
    expect(hintForApiStatus(200)).toBeUndefined();
    expect(hintForApiStatus(301)).toBeUndefined();
  });
});

describe("hintForApiError", () => {
  it("upgrades 400 to auth hint when message says key is invalid", () => {
    expect(hintForApiError(400, "API key not valid. Please pass a valid API key.")).toMatch(
      /GOOGLE_MAPS_API_KEY/,
    );
  });

  it("upgrades 400 to auth hint for 'API key expired'", () => {
    expect(hintForApiError(400, "API key expired")).toMatch(/GOOGLE_MAPS_API_KEY/);
  });

  it("upgrades 400 to auth hint for 'permission denied'", () => {
    expect(hintForApiError(400, "permission denied for this API")).toMatch(
      /GOOGLE_MAPS_API_KEY/,
    );
  });

  it("falls back to status-based hint when message is not auth-related", () => {
    expect(hintForApiError(400, "invalid waypoint")).toMatch(/rejected/);
  });

  it("keeps existing 401 hint as-is", () => {
    expect(hintForApiError(401, "anything")).toMatch(/GOOGLE_MAPS_API_KEY/);
  });

  it("is case-insensitive", () => {
    expect(hintForApiError(400, "API KEY NOT VALID")).toMatch(/GOOGLE_MAPS_API_KEY/);
  });
});
