export interface WaygoErrorOptions {
  hint?: string;
  cause?: unknown;
}

export class WaygoError extends Error {
  readonly hint?: string;
  override readonly cause?: unknown;

  constructor(message: string, options: WaygoErrorOptions = {}) {
    super(message);
    this.name = "WaygoError";
    this.hint = options.hint;
    this.cause = options.cause;
  }
}

export class WaygoConfigError extends WaygoError {
  constructor(message: string, options: WaygoErrorOptions = {}) {
    super(message, options);
    this.name = "WaygoConfigError";
  }
}

export class WaygoCancelledError extends WaygoError {
  constructor(message = "Cancelled.") {
    super(message);
    this.name = "WaygoCancelledError";
  }
}

export class WaygoInputError extends WaygoError {
  constructor(message: string, options: WaygoErrorOptions = {}) {
    super(message, options);
    this.name = "WaygoInputError";
  }
}

export class WaygoApiError extends WaygoError {
  readonly service: "places" | "routes";
  readonly status?: number;

  constructor(
    message: string,
    options: WaygoErrorOptions & { service: "places" | "routes"; status?: number },
  ) {
    super(message, options);
    this.name = "WaygoApiError";
    this.service = options.service;
    this.status = options.status;
  }
}

const AUTH_DETAIL_PATTERN = /api key (not valid|expired|invalid)|permission denied|not authorized/i;

export function hintForApiError(status: number | undefined, detail: string): string | undefined {
  if (AUTH_DETAIL_PATTERN.test(detail)) {
    return hintForApiStatus(401);
  }
  return hintForApiStatus(status);
}

export function hintForApiStatus(status?: number): string | undefined {
  if (status === 401 || status === 403) {
    return "Check that GOOGLE_MAPS_API_KEY is set and the Routes + Places (New) APIs are enabled for it.";
  }
  if (status === 429) {
    return "Google rate-limited the request. Wait a bit or check your project's quota.";
  }
  if (status === 400) {
    return "The request was rejected. Verify the place query or trip parameters.";
  }
  if (status && status >= 500) {
    return "Google's API returned a server error. Retry shortly.";
  }
  return undefined;
}
