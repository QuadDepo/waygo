import { addSeconds, parseISO } from "date-fns";
import type { RouteSchema } from "./schemas";
import type {
  JsonFare,
  JsonPlacesOutput,
  JsonTransitStep,
  JsonTripLeg,
  JsonTripRoute,
  JsonTripStep,
  PlaceCandidate,
} from "./types";
import { formatClock, formatHumanDuration, parseDurationSeconds } from "./utils/datetime";
import { colorizeBadge, vehicleFallbackColors, vehicleLabel } from "./utils/vehicle";

function dim(s: string): string {
  if (!process.stdout.isTTY || process.env.NO_COLOR) {
    return s;
  }
  return `\x1b[2m${s}\x1b[0m`;
}

function formatDistance(distanceMeters?: number): string {
  if (distanceMeters === undefined) {
    return "distance unknown";
  }

  if (distanceMeters < 1000) {
    return `${distanceMeters}m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)}km`;
}

function parseFare(fare: RouteSchema["fare"]): JsonFare | undefined {
  if (!fare) {
    return undefined;
  }

  const unitsValue = fare.units ?? 0;
  const units = typeof unitsValue === "number" ? unitsValue : Number.parseFloat(unitsValue || "0");
  if (Number.isNaN(units)) {
    return undefined;
  }

  const nanos = fare.nanos ?? 0;
  if (Number.isNaN(nanos)) {
    return undefined;
  }

  const amount = units + nanos / 1_000_000_000;

  return {
    currencyCode: fare.currencyCode,
    amount,
  };
}

function parseTransitStep(step: RouteSchema["legs"][number]["steps"][number]): JsonTripStep {
  const details = step.transitDetails;
  const line = details?.transitLine;

  return {
    type: "transit",
    departureTime: details?.stopDetails?.departureTime,
    arrivalTime: details?.stopDetails?.arrivalTime,
    departureStop: details?.stopDetails?.departureStop?.name,
    arrivalStop: details?.stopDetails?.arrivalStop?.name,
    headsign: details?.headsign,
    lineName: line?.name,
    lineShortName: line?.nameShort,
    tripShortText: details?.tripShortText,
    lineColor: line?.color,
    lineTextColor: line?.textColor,
    vehicleType: line?.vehicle?.type,
    vehicleName: line?.vehicle?.name?.text,
    stopCount: details?.stopCount ?? details?.numStops,
    durationSeconds: parseDurationSeconds(step.staticDuration),
    distanceMeters: step.distanceMeters,
  };
}

function parseWalkStep(step: RouteSchema["legs"][number]["steps"][number]): JsonTripStep {
  return {
    type: "walk",
    instruction: step.navigationInstruction?.instructions,
    durationSeconds: parseDurationSeconds(step.staticDuration),
    distanceMeters: step.distanceMeters,
  };
}

// --- JSON output (unchanged — retains all granular walk sub-steps) ---

export function routesToJson(routes: RouteSchema[]): JsonTripRoute[] {
  return routes.map((route, index) => {
    const legs: JsonTripLeg[] = route.legs.map((leg) => ({
      departureTime: leg.departureTime,
      arrivalTime: leg.arrivalTime,
      steps: leg.steps.map((step) => {
        if (step.transitDetails) {
          return parseTransitStep(step);
        }

        return parseWalkStep(step);
      }),
    }));

    return {
      index: index + 1,
      durationSeconds: parseDurationSeconds(route.duration),
      distanceMeters: route.distanceMeters,
      fare: parseFare(route.fare),
      legs,
    };
  });
}

export function placesToJson(query: string, places: PlaceCandidate[]): JsonPlacesOutput {
  return {
    query,
    places,
  };
}

// --- Human rendering helpers ---

function formatFare(fare?: JsonFare): string {
  if (!fare) {
    return "";
  }

  return ` - ${fare.currencyCode} ${fare.amount.toFixed(2)}`;
}

type RouteSegment =
  | { kind: "walk"; durationSeconds: number; distanceMeters: number }
  | { kind: "transit"; step: JsonTransitStep };

function groupStepsIntoSegments(steps: JsonTripStep[]): RouteSegment[] {
  const segments: RouteSegment[] = [];

  for (const step of steps) {
    if (step.type === "transit") {
      segments.push({ kind: "transit", step });
    } else {
      const last = segments.at(-1);
      if (last?.kind === "walk") {
        last.durationSeconds += step.durationSeconds ?? 0;
        last.distanceMeters += step.distanceMeters ?? 0;
      } else {
        segments.push({
          kind: "walk",
          durationSeconds: step.durationSeconds ?? 0,
          distanceMeters: step.distanceMeters ?? 0,
        });
      }
    }
  }

  return segments;
}

function buildSegmentSummary(segments: RouteSegment[]): string {
  const parts = segments.map((seg) => {
    if (seg.kind === "walk") {
      return dim(`Walk ${formatHumanDuration(seg.durationSeconds)}`);
    }

    const { step } = seg;
    const lineCode = step.lineShortName ?? step.tripShortText ?? step.lineName ?? "TRANSIT";
    const vehicle = vehicleLabel(step.vehicleType);
    const fallback = vehicleFallbackColors(step.vehicleType);
    const badge = colorizeBadge(` ${lineCode} `, {
      backgroundColor: step.lineColor ?? fallback?.bg,
      textColor: step.lineTextColor ?? fallback?.fg,
    });

    return `${badge} ${vehicle}`;
  });

  return parts.join(dim(" → "));
}

function buildPlainSegmentSummary(segments: RouteSegment[]): string {
  const parts = segments.map((seg) => {
    if (seg.kind === "walk") {
      return `Walk ${formatHumanDuration(seg.durationSeconds)}`;
    }

    const { step } = seg;
    const lineCode = step.lineShortName ?? step.tripShortText ?? step.lineName ?? "TRANSIT";
    const vehicle = vehicleLabel(step.vehicleType);
    return `${lineCode} ${vehicle}`;
  });

  return parts.join(" → ");
}

function renderStep(step: JsonTransitStep): string[] {
  const departureTime = formatClock(step.departureTime) ?? "--:--";
  const arrivalTime = formatClock(step.arrivalTime) ?? "--:--";
  const departureStop = step.departureStop ?? "Unknown stop";
  const arrivalStop = step.arrivalStop ?? "Unknown stop";
  const lineCode = step.lineShortName ?? step.tripShortText ?? step.lineName ?? "TRANSIT";
  const headsign = step.headsign ?? arrivalStop;
  const stopInfo = [
    step.stopCount !== undefined ? `${step.stopCount} stops` : undefined,
    step.durationSeconds !== undefined ? formatHumanDuration(step.durationSeconds) : undefined,
  ]
    .filter(Boolean)
    .join(", ");
  const details = stopInfo ? ` (${stopInfo})` : "";
  const vehicle = vehicleLabel(step.vehicleType);
  const badge = colorizeBadge(` ${lineCode} `, {
    backgroundColor: step.lineColor,
    textColor: step.lineTextColor,
  });

  return [
    `  ${departureTime} ●  ${departureStop}`,
    `        ${dim("│")}  ${badge} ${vehicle} → ${headsign}${details}`,
    `  ${arrivalTime} ●  ${arrivalStop}`,
  ];
}

function computeWalkTime(
  index: number,
  walkDuration: number,
  segments: RouteSegment[],
  legDepartureTime: string | undefined,
  lastArrivalTime: string | undefined,
): string | undefined {
  if (index === 0) {
    const nextSeg = segments[index + 1];
    if (nextSeg?.kind === "transit" && nextSeg.step.departureTime && walkDuration > 0) {
      try {
        const dep = parseISO(nextSeg.step.departureTime);
        return formatClock(addSeconds(dep, -walkDuration).toISOString());
      } catch {
        // fall through
      }
    }
    return formatClock(legDepartureTime);
  }

  return formatClock(lastArrivalTime);
}

function renderSegmentTimeline(
  segments: RouteSegment[],
  legDepartureTime?: string,
): string[] {
  const lines: string[] = [];
  let lastArrivalTime: string | undefined;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;

    if (seg.kind === "walk") {
      const walkDur = formatHumanDuration(seg.durationSeconds);
      const walkTime = computeWalkTime(i, seg.durationSeconds, segments, legDepartureTime, lastArrivalTime);
      const timeCol = walkTime ?? "     ";

      const nextSeg = segments[i + 1];
      const nextStop = nextSeg?.kind === "transit" ? nextSeg.step.departureStop : undefined;
      const suffix = nextStop ? ` to ${nextStop}` : "";
      lines.push(`  ${timeCol} ${dim("┆")}  Walk ${walkDur}${suffix}`);
    } else {
      lines.push(...renderStep(seg.step));
      lastArrivalTime = seg.step.arrivalTime;
    }
  }

  return lines;
}

export function getRouteDepArr(route: JsonTripRoute): { dep: string | undefined; arr: string | undefined } {
  const firstLeg = route.legs[0];
  const lastLeg = route.legs.at(-1);

  const dep =
    firstLeg?.departureTime ??
    firstLeg?.steps.find((s): s is JsonTransitStep => s.type === "transit")?.departureTime;

  const lastSteps = lastLeg?.steps ?? [];
  const arr =
    lastLeg?.arrivalTime ??
    [...lastSteps].reverse().find((s): s is JsonTransitStep => s.type === "transit")?.arrivalTime;

  return { dep, arr };
}

export function renderSingleRouteHuman(route: JsonTripRoute): string {
  const lines: string[] = [];
  const { dep: depRaw, arr: arrRaw } = getRouteDepArr(route);
  const dep = formatClock(depRaw);
  const arr = formatClock(arrRaw);
  const duration = formatHumanDuration(route.durationSeconds);
  const distance = formatDistance(route.distanceMeters);
  const fare = formatFare(route.fare);
  const timeRange = dep && arr ? `${dep} → ${arr} - ` : "";
  lines.push(`Route ${route.index} - ${timeRange}${duration} - ${distance}${fare}`);

  for (const leg of route.legs) {
    const segments = groupStepsIntoSegments(leg.steps);

    if (segments.length > 0) {
      lines.push("");
      lines.push(`  ${buildSegmentSummary(segments)}`);
      lines.push("");
    }

    lines.push(...renderSegmentTimeline(segments, leg.departureTime));
  }

  return lines.join("\n");
}

export function buildRouteSelectOptions(
  routes: JsonTripRoute[],
): { value: number; label: string; hint: string }[] {
  return routes.map((route, index) => {
    const { dep: depRaw, arr: arrRaw } = getRouteDepArr(route);
    const dep = formatClock(depRaw);
    const arr = formatClock(arrRaw);
    const duration = formatHumanDuration(route.durationSeconds);

    let label: string;
    if (dep && arr) {
      label = `${dep} → ${arr} · ${duration}`;
    } else {
      const distance = formatDistance(route.distanceMeters);
      label = `${duration} · ${distance}`;
    }

    const allSteps = route.legs.flatMap((l) => l.steps);
    const segments = groupStepsIntoSegments(allSteps);
    const hint = buildPlainSegmentSummary(segments);

    return { value: index, label, hint };
  });
}

export function renderPlacesHuman(query: string, places: PlaceCandidate[]): string {
  if (places.length === 0) {
    return `No places found for "${query}".`;
  }

  const lines = [`Found ${places.length} place(s) for "${query}":`];

  for (const [index, place] of places.entries()) {
    const primaryType = place.primaryType ? ` (${place.primaryType})` : "";
    lines.push(`${index + 1}. ${place.displayName} - ${place.formattedAddress}${primaryType}`);
  }

  return lines.join("\n");
}

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printJsonError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  printJson({ error: message });
}
