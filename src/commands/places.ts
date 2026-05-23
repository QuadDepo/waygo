import { isCancel, spinner, text } from "@clack/prompts";
import { defineCommand } from "citty";

import { searchPlaces } from "../api";
import { loadWaygoConfig } from "../config";
import { WaygoCancelledError, WaygoInputError } from "../errors";
import { placesToJson, printJson, renderPlacesHuman } from "../output";
import { setJsonMode } from "../runtime";
import { getArgString } from "../utils/args";

export const placesCommand = defineCommand({
  meta: {
    name: "places",
    description: "Search places via Google Places API",
  },
  args: {
    query: {
      type: "positional",
      description: "Place query",
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
    let query = getArgString(context.args.query);

    if (!query) {
      if (jsonMode) {
        throw new WaygoInputError("Missing query.", {
          hint: "Usage: waygo places <query> --json",
        });
      }

      const answer = await text({ message: "Search place" });
      if (isCancel(answer)) {
        throw new WaygoCancelledError();
      }

      query = getArgString(answer);
      if (!query) {
        throw new WaygoInputError("Query cannot be empty.");
      }
    }

    const loading = jsonMode ? null : spinner();
    if (loading) loading.start(`Searching places for "${query}"...`);

    try {
      const places = await searchPlaces({
        apiKey: config.apiKey,
        query,
        fieldMask: config.placesFieldMask,
        maxResults: config.placeSearchLimit,
      });

      if (loading) loading.stop(`Found ${places.length} place(s)`);

      if (jsonMode) {
        printJson(placesToJson(query, places));
        return;
      }

      process.stdout.write(`${renderPlacesHuman(query, places)}\n`);
    } catch (error) {
      if (loading) loading.stop("Request failed");
      throw error;
    }
  },
});
