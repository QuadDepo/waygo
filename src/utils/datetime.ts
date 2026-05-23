import { addDays, addMinutes, format, isValid, parse, parseISO } from "date-fns";

import { WaygoInputError } from "../errors";

export interface ResolveTripTimeOptions {
  departAt?: string;
  arriveBy?: string;
  date?: string;
  now?: Date;
}

export interface ResolvedTripTimes {
  departureTime?: string;
  arrivalTime?: string;
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/;
const TIME_ONLY_PATTERN = /^\d{2}:\d{2}$/;
const RELATIVE_OFFSET_PATTERN = /^\+(\d+)(m|h|d)$/i;
const TOMORROW_PATTERN = /^tomorrow(?:\s+(\d{2}:\d{2}))?$/i;
const TODAY_PATTERN = /^today(?:\s+(\d{2}:\d{2}))?$/i;

function parseDateOnly(value: string, referenceDate: Date): Date | null {
  const parsed = parse(value, "yyyy-MM-dd", referenceDate);
  if (!isValid(parsed)) {
    return null;
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function cloneWithClock(baseDate: Date, clock: string, referenceDate: Date): Date | null {
  const parsedTime = parse(clock, "HH:mm", referenceDate);

  if (!isValid(parsedTime)) {
    return null;
  }

  const date = new Date(baseDate);
  date.setHours(parsedTime.getHours(), parsedTime.getMinutes(), 0, 0);
  return date;
}

function parseRelativeOffset(value: string, now: Date): Date | null {
  const match = RELATIVE_OFFSET_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  const amount = Number.parseInt(match[1]!, 10);
  const unit = match[2]!.toLowerCase();
  if (!Number.isFinite(amount)) {
    return null;
  }
  const minutes = unit === "m" ? amount : unit === "h" ? amount * 60 : amount * 60 * 24;
  return addMinutes(now, minutes);
}

function parseRelativeKeyword(value: string, now: Date): Date | null {
  if (value.toLowerCase() === "now") {
    return new Date(now);
  }

  const tomorrowMatch = TOMORROW_PATTERN.exec(value);
  if (tomorrowMatch) {
    const base = addDays(now, 1);
    base.setHours(0, 0, 0, 0);
    if (tomorrowMatch[1]) {
      return cloneWithClock(base, tomorrowMatch[1], now);
    }
    base.setHours(now.getHours(), now.getMinutes(), 0, 0);
    return base;
  }

  const todayMatch = TODAY_PATTERN.exec(value);
  if (todayMatch) {
    const base = new Date(now);
    base.setHours(0, 0, 0, 0);
    if (todayMatch[1]) {
      return cloneWithClock(base, todayMatch[1], now);
    }
    base.setHours(now.getHours(), now.getMinutes(), 0, 0);
    return base;
  }

  return null;
}

function parseFlexibleDateTime(value: string, baseDate: Date | null, now: Date): Date | null {
  const trimmed = value.trim();

  const keyword = parseRelativeKeyword(trimmed, now);
  if (keyword) {
    return keyword;
  }

  const offset = parseRelativeOffset(trimmed, now);
  if (offset) {
    return offset;
  }

  if (TIME_ONLY_PATTERN.test(trimmed)) {
    return cloneWithClock(baseDate ?? now, trimmed, now);
  }

  if (DATE_TIME_PATTERN.test(trimmed)) {
    const parsed = parse(trimmed, "yyyy-MM-dd HH:mm", now);
    return isValid(parsed) ? parsed : null;
  }

  if (DATE_ONLY_PATTERN.test(trimmed)) {
    return parseDateOnly(trimmed, now);
  }

  const iso = parseISO(trimmed);
  if (isValid(iso)) {
    return iso;
  }

  return null;
}

function formatRfc3339Local(value: Date): string {
  return format(value, "yyyy-MM-dd'T'HH:mm:ssxxx");
}

export function resolveTripTimes(options: ResolveTripTimeOptions): ResolvedTripTimes {
  if (options.departAt && options.arriveBy) {
    throw new WaygoInputError("Use either --depart-at or --arrive-by, not both.");
  }

  const now = options.now ?? new Date();
  const dateFromFlag = options.date ? parseDateOnly(options.date, now) : null;

  if (options.date && !dateFromFlag) {
    throw new WaygoInputError("Invalid --date value. Expected YYYY-MM-DD.");
  }

  if (options.departAt) {
    const parsed = parseFlexibleDateTime(options.departAt, dateFromFlag, now);
    if (!parsed) {
      throw new WaygoInputError("Invalid --depart-at value.", {
        hint: "Use now, +30m, +2h, HH:MM, today HH:MM, tomorrow HH:MM, YYYY-MM-DD HH:MM, or ISO.",
      });
    }

    return { departureTime: formatRfc3339Local(parsed) };
  }

  if (options.arriveBy) {
    const parsed = parseFlexibleDateTime(options.arriveBy, dateFromFlag, now);
    if (!parsed) {
      throw new WaygoInputError("Invalid --arrive-by value.", {
        hint: "Use now, +30m, +2h, HH:MM, today HH:MM, tomorrow HH:MM, YYYY-MM-DD HH:MM, or ISO.",
      });
    }

    return { arrivalTime: formatRfc3339Local(parsed) };
  }

  if (dateFromFlag) {
    const withCurrentTime = new Date(dateFromFlag);
    withCurrentTime.setHours(now.getHours(), now.getMinutes(), 0, 0);
    return { departureTime: formatRfc3339Local(withCurrentTime) };
  }

  return {};
}

export function parseDurationSeconds(duration?: string): number | undefined {
  if (!duration) {
    return undefined;
  }

  const match = /^(\d+(?:\.\d+)?)s$/.exec(duration.trim());
  if (!match) {
    return undefined;
  }

  const seconds = match[1];
  if (!seconds) {
    return undefined;
  }

  return Math.round(Number.parseFloat(seconds));
}

export function formatClock(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = parseISO(value);
  if (!isValid(parsed)) {
    return undefined;
  }

  return format(parsed, "HH:mm");
}

export function formatHumanDuration(seconds?: number): string {
  if (seconds === undefined) {
    return "unknown";
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}
