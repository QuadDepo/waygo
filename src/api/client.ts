import { $fetch, FetchError } from "ofetch";

import { WaygoApiError, hintForApiError } from "../errors";

const GOOGLE_BASE_URLS = {
  places: "https://places.googleapis.com",
  routes: "https://routes.googleapis.com",
} as const;
const GOOGLE_API_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 30_000;
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

type GoogleService = keyof typeof GOOGLE_BASE_URLS;

interface GooglePostOptions {
  service: GoogleService;
  path: string;
  apiKey: string;
  body: Record<string, unknown>;
  fieldMask?: string;
  maxAttempts?: number;
}

interface GoogleErrorPayload {
  error?: {
    message?: string;
    details?: Array<{
      fieldViolations?: Array<{ description?: string }>;
    }>;
  };
}

function buildHeaders(apiKey: string, fieldMask?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": apiKey,
  };

  if (fieldMask) {
    headers["X-Goog-FieldMask"] = fieldMask;
  }

  return headers;
}

function toWaygoApiError(service: GoogleService, error: unknown): WaygoApiError {
  if (error instanceof FetchError) {
    const status = error.response?.status;
    const payload = error.data as GoogleErrorPayload | undefined;
    const fieldViolation = payload?.error?.details
      ?.flatMap((detail) => detail.fieldViolations ?? [])
      .map((violation) => violation.description)
      .find((description): description is string => Boolean(description));
    const detail = [payload?.error?.message || error.message, fieldViolation]
      .filter(Boolean)
      .join(": ");
    const message = `Google ${service} API error${status ? ` (${status})` : ""}: ${detail}`;
    return new WaygoApiError(message, {
      service,
      status,
      hint: hintForApiError(status, detail),
      cause: error,
    });
  }

  if (error instanceof Error) {
    return new WaygoApiError(`Google ${service} API request failed: ${error.message}`, {
      service,
      cause: error,
    });
  }

  return new WaygoApiError(`Google ${service} API request failed`, { service });
}

function isRetryable(error: unknown): boolean {
  if (error instanceof FetchError) {
    const status = error.response?.status;
    if (status === undefined) {
      return true;
    }
    return RETRYABLE_STATUSES.has(status);
  }
  return false;
}

function parseRetryAfterMs(error: unknown): number | undefined {
  if (!(error instanceof FetchError)) {
    return undefined;
  }

  const header = error.response?.headers.get("retry-after");
  if (!header) {
    return undefined;
  }

  const asSeconds = Number(header);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.min(asSeconds * 1000, MAX_BACKOFF_MS);
  }

  const asDate = Date.parse(header);
  if (Number.isFinite(asDate)) {
    return Math.min(Math.max(asDate - Date.now(), 0), MAX_BACKOFF_MS);
  }

  return undefined;
}

function computeBackoffMs(attempt: number): number {
  const exp = BASE_BACKOFF_MS * 2 ** (attempt - 1);
  const jitter = Math.random() * BASE_BACKOFF_MS;
  return Math.min(exp + jitter, MAX_BACKOFF_MS);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function googlePost<T>(options: GooglePostOptions): Promise<T> {
  const baseURL = GOOGLE_BASE_URLS[options.service];
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await $fetch<T>(`${baseURL}${options.path}`, {
        method: "POST",
        headers: buildHeaders(options.apiKey, options.fieldMask),
        body: options.body,
        timeout: GOOGLE_API_TIMEOUT_MS,
      });
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts || !isRetryable(error)) {
        break;
      }
      const wait = parseRetryAfterMs(error) ?? computeBackoffMs(attempt);
      await delay(wait);
    }
  }

  throw toWaygoApiError(options.service, lastError);
}
