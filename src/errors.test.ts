import { describe, expect, it } from "vitest";

import {
  WaygoApiError,
  WaygoCancelledError,
  WaygoConfigError,
  WaygoError,
  WaygoInputError,
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
