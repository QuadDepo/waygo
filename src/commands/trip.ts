import { intro, isCancel, outro, select, spinner, text } from "@clack/prompts";
import { defineCommand } from "citty";

import { fetchTransitRoutes, tryResolvePlace } from "../api";
import { loadWaygoConfig, resolveAlias } from "../config";
import { WaygoCancelledError, WaygoInputError } from "../errors";
import {
  buildRouteSelectOptions,
  getRouteDepArr,
  printJson,
  renderSingleRouteHuman,
  routesToJson,
} from "../output";
import { setJsonMode } from "../runtime";
import type { LoadedWaygoConfig, PlaceCandidate, TripPreference } from "../types";
import { getArgString } from "../utils/args";
import { formatClock, resolveTripTimes } from "../utils/datetime";

function isTripPreference(value: unknown): value is TripPreference {
  return value === "less-walking" || value === "fewer-transfers";
}

async function promptPlaceQuery(label: string): Promise<string> {
  const answer = await text({ message: `${label}` });

  if (isCancel(answer)) {
    throw new WaygoCancelledError();
  }

  const value = getArgString(answer);
  if (!value) {
    throw new WaygoInputError(`${label} cannot be empty.`);
  }

  return value;
}

async function resolvePlaceForTrip(options: {
  label: "From" | "To";
  initialQuery?: string;
  jsonMode: boolean;
  config: LoadedWaygoConfig;
}): Promise<PlaceCandidate> {
  let query = options.initialQuery;

  while (true) {
    if (!query) {
      if (options.jsonMode) {
        throw new WaygoInputError(`Missing ${options.label.toLowerCase()} value.`);
      }

      query = await promptPlaceQuery(`${options.label} (address or place)`);
    }

    const resolved = await tryResolvePlace({
      apiKey: options.config.apiKey,
      query,
      fieldMask: options.config.placesFieldMask,
      maxResults: options.config.placeSearchLimit,
    });

    if (resolved.type === "found") {
      return resolved.place;
    }

    if (resolved.type === "not_found") {
      if (options.jsonMode) {
        throw new WaygoInputError(`No place found for "${query}".`);
      }

      query = await promptPlaceQuery(
        `No match for "${query}". Enter ${options.label.toLowerCase()} again`,
      );
      continue;
    }

    if (options.jsonMode) {
      const hints = resolved.places
        .slice(0, 3)
        .map((place) => `${place.displayName} (${place.formattedAddress})`)
        .join(", ");
      throw new WaygoInputError(`Ambiguous place "${query}". Candidates: ${hints}`);
    }

    const selectedPlaceId = await select({
      message: `Select ${options.label.toLowerCase()} place`,
      options: resolved.places.map((place) => ({
        value: place.placeId,
        label: place.displayName,
        hint: place.formattedAddress,
      })),
    });

    if (isCancel(selectedPlaceId)) {
      throw new WaygoCancelledError();
    }

    const selectedPlace = resolved.places.find((place) => place.placeId === selectedPlaceId);

    if (selectedPlace) {
      return selectedPlace;
    }

    query = undefined;
  }
}

export const tripCommand = defineCommand({
  meta: {
    name: "trip",
    description: "Transit directions A to B",
  },
  args: {
    from: {
      type: "positional",
      description: "Origin place",
      required: false,
    },
    to: {
      type: "positional",
      description: "Destination place",
      required: false,
    },
    "depart-at": {
      type: "string",
      description: "Depart at HH:MM, +30m, tomorrow 09:00, YYYY-MM-DD HH:MM, or ISO",
      required: false,
    },
    "arrive-by": {
      type: "string",
      description: "Arrive by HH:MM, +30m, tomorrow 09:00, YYYY-MM-DD HH:MM, or ISO",
      required: false,
    },
    date: {
      type: "string",
      description: "Date for HH:MM values (YYYY-MM-DD)",
      required: false,
    },
    prefer: {
      type: "enum",
      options: ["less-walking", "fewer-transfers"],
      description: "Transit preference",
      required: false,
    },
    json: {
      type: "boolean",
      alias: "j",
      description: "Output JSON",
      default: false,
    },
  },
  async run(context) {
    const jsonMode = Boolean(context.args.json);
    setJsonMode(jsonMode);

    const config = await loadWaygoConfig();
    const fromValue = getArgString(context.args.from);
    const toValue = getArgString(context.args.to);
    const preferValue = getArgString(context.args.prefer);
    const preference = isTripPreference(preferValue) ? preferValue : undefined;

    if (preferValue && !preference) {
      throw new WaygoInputError("Invalid --prefer value. Use less-walking or fewer-transfers.");
    }

    const times = resolveTripTimes({
      departAt: getArgString(context.args["depart-at"]),
      arriveBy: getArgString(context.args["arrive-by"]),
      date: getArgString(context.args.date),
    });

    const fromQuery = fromValue ? resolveAlias(fromValue, config.aliases) : undefined;
    const toQuery = toValue ? resolveAlias(toValue, config.aliases) : undefined;

    const loading = jsonMode ? null : spinner();

    if (!jsonMode) {
      intro("waygo transit");
      loading!.start("Resolving origin...");
    }

    try {
      const origin = await resolvePlaceForTrip({
        label: "From",
        initialQuery: fromQuery,
        jsonMode,
        config,
      });

      if (loading) loading.message("Resolving destination...");

      const destination = await resolvePlaceForTrip({
        label: "To",
        initialQuery: toQuery,
        jsonMode,
        config,
      });

      if (loading) loading.message("Computing transit routes...");

      const routes = await fetchTransitRoutes({
        apiKey: config.apiKey,
        origin: { placeId: origin.placeId },
        destination: { placeId: destination.placeId },
        departureTime: times.departureTime,
        arrivalTime: times.arrivalTime,
        preference,
        fieldMask: config.routesFieldMask,
      });

      if (jsonMode) {
        printJson(routesToJson(routes));
        return;
      }

      const jsonRoutes = routesToJson(routes);
      loading!.stop(`Found ${jsonRoutes.length} route(s)`);

      if (jsonRoutes.length === 0) {
        outro("No transit routes found.");
        return;
      }

      const firstDep = jsonRoutes[0] ? formatClock(getRouteDepArr(jsonRoutes[0]).dep) : undefined;
      const lastDep = jsonRoutes.at(-1)
        ? formatClock(getRouteDepArr(jsonRoutes.at(-1)!).dep)
        : undefined;
      const timeRange =
        firstDep && lastDep && firstDep !== lastDep
          ? ` · ${firstDep} – ${lastDep}`
          : firstDep
            ? ` · departing ${firstDep}`
            : "";

      const selected = await select({
        message: `Select a route${timeRange}`,
        options: buildRouteSelectOptions(jsonRoutes),
      });

      if (isCancel(selected)) {
        throw new WaygoCancelledError();
      }

      const route = jsonRoutes[selected as number];
      if (route) {
        process.stdout.write(`${renderSingleRouteHuman(route)}\n`);
      }
      outro(`${origin.displayName} -> ${destination.displayName}`);
    } catch (error) {
      if (loading) loading.stop("Request failed");
      throw error;
    }
  },
});
