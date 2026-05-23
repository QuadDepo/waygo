import { describe, expect, it } from "vitest";

import {
  formatClock,
  formatHumanDuration,
  parseDurationSeconds,
  resolveTripTimes,
} from "./datetime";

const FIXED_NOW = new Date("2026-05-23T10:00:00+02:00");

describe("resolveTripTimes", () => {
  it("returns empty when no inputs", () => {
    expect(resolveTripTimes({ now: FIXED_NOW })).toEqual({});
  });

  it("rejects both depart-at and arrive-by", () => {
    expect(() =>
      resolveTripTimes({ departAt: "10:00", arriveBy: "11:00", now: FIXED_NOW }),
    ).toThrow(/either --depart-at or --arrive-by/);
  });

  it("parses HH:MM into today", () => {
    const result = resolveTripTimes({ departAt: "14:30", now: FIXED_NOW });
    expect(result.departureTime).toMatch(/^2026-05-23T14:30:00/);
  });

  it("parses HH:MM with --date", () => {
    const result = resolveTripTimes({ departAt: "09:15", date: "2026-06-01", now: FIXED_NOW });
    expect(result.departureTime).toMatch(/^2026-06-01T09:15:00/);
  });

  it("parses YYYY-MM-DD HH:MM", () => {
    const result = resolveTripTimes({ arriveBy: "2026-12-31 23:00", now: FIXED_NOW });
    expect(result.arrivalTime).toMatch(/^2026-12-31T23:00:00/);
  });

  it("parses ISO 8601", () => {
    const result = resolveTripTimes({ departAt: "2026-07-04T08:30:00+02:00", now: FIXED_NOW });
    expect(result.departureTime).toMatch(/^2026-07-04T08:30:00/);
  });

  it("rejects garbage --depart-at", () => {
    expect(() => resolveTripTimes({ departAt: "soon", now: FIXED_NOW })).toThrow(
      /Invalid --depart-at/,
    );
  });

  it("rejects invalid --date", () => {
    expect(() => resolveTripTimes({ date: "2026-13-99", now: FIXED_NOW })).toThrow(
      /Invalid --date/,
    );
  });

  it("uses --date alone with current clock for departure", () => {
    const result = resolveTripTimes({ date: "2026-06-01", now: FIXED_NOW });
    expect(result.departureTime).toMatch(/^2026-06-01T10:00:00/);
  });
});

describe("resolveTripTimes — relative grammar", () => {
  it("parses 'now'", () => {
    const result = resolveTripTimes({ departAt: "now", now: FIXED_NOW });
    expect(result.departureTime).toMatch(/^2026-05-23T10:00:00/);
  });

  it("parses +30m", () => {
    const result = resolveTripTimes({ departAt: "+30m", now: FIXED_NOW });
    expect(result.departureTime).toMatch(/^2026-05-23T10:30:00/);
  });

  it("parses +2h", () => {
    const result = resolveTripTimes({ departAt: "+2h", now: FIXED_NOW });
    expect(result.departureTime).toMatch(/^2026-05-23T12:00:00/);
  });

  it("parses +1d", () => {
    const result = resolveTripTimes({ arriveBy: "+1d", now: FIXED_NOW });
    expect(result.arrivalTime).toMatch(/^2026-05-24T10:00:00/);
  });

  it("parses tomorrow with clock", () => {
    const result = resolveTripTimes({ departAt: "tomorrow 09:00", now: FIXED_NOW });
    expect(result.departureTime).toMatch(/^2026-05-24T09:00:00/);
  });

  it("parses bare tomorrow (carries current clock)", () => {
    const result = resolveTripTimes({ departAt: "tomorrow", now: FIXED_NOW });
    expect(result.departureTime).toMatch(/^2026-05-24T10:00:00/);
  });

  it("parses today HH:MM", () => {
    const result = resolveTripTimes({ arriveBy: "today 18:00", now: FIXED_NOW });
    expect(result.arrivalTime).toMatch(/^2026-05-23T18:00:00/);
  });

  it("is case-insensitive for keywords", () => {
    const result = resolveTripTimes({ departAt: "TOMORROW 09:00", now: FIXED_NOW });
    expect(result.departureTime).toMatch(/^2026-05-24T09:00:00/);
  });
});

describe("parseDurationSeconds", () => {
  it.each([
    ["120s", 120],
    ["3.5s", 4],
    ["0s", 0],
  ])("parses %s", (input, expected) => {
    expect(parseDurationSeconds(input)).toBe(expected);
  });

  it.each([undefined, "", "120", "120ms", "abc"])("returns undefined for %s", (input) => {
    expect(parseDurationSeconds(input)).toBeUndefined();
  });
});

describe("formatClock", () => {
  it("formats ISO to HH:MM", () => {
    expect(formatClock("2026-05-23T14:30:00+02:00")).toBe("14:30");
  });

  it("returns undefined for invalid input", () => {
    expect(formatClock(undefined)).toBeUndefined();
    expect(formatClock("not a date")).toBeUndefined();
  });
});

describe("formatHumanDuration", () => {
  it.each([
    [undefined, "unknown"],
    [30, "30s"],
    [60, "1m"],
    [90, "2m"],
    [3600, "1h"],
    [3660, "1h 1m"],
    [7320, "2h 2m"],
  ])("formats %s as %s", (input, expected) => {
    expect(formatHumanDuration(input)).toBe(expected);
  });
});
