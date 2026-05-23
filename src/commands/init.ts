import { existsSync } from "node:fs";

import { confirm, intro, isCancel, outro, password } from "@clack/prompts";
import { defineCommand } from "citty";

import { HOME_CONFIG_FILE, writeWaygoConfig } from "../config";
import { WaygoCancelledError, WaygoInputError } from "../errors";
import { setJsonMode } from "../runtime";
import { getArgString } from "../utils/args";

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description: "Write ~/.config/waygo/config.json with your Google Maps API key",
  },
  args: {
    "api-key": {
      type: "string",
      description: "Google Maps API key (skip the prompt)",
      required: false,
    },
    force: {
      type: "boolean",
      description: "Overwrite existing config without prompting",
      default: false,
    },
  },
  async run(context) {
    setJsonMode(false);
    intro("waygo init");

    const argKey = getArgString(context.args["api-key"]);
    const force = Boolean(context.args.force);

    if (existsSync(HOME_CONFIG_FILE) && !force) {
      const overwrite = await confirm({
        message: `${HOME_CONFIG_FILE} already exists. Overwrite?`,
        initialValue: false,
      });
      if (isCancel(overwrite)) throw new WaygoCancelledError();
      if (!overwrite) {
        outro("Left existing config untouched.");
        return;
      }
    }

    let apiKey = argKey;
    if (!apiKey) {
      const answer = await password({
        message: "Google Maps API key",
        validate: (value) =>
          value && value.trim().length > 0 ? undefined : "API key cannot be empty.",
      });
      if (isCancel(answer)) throw new WaygoCancelledError();
      apiKey = answer.trim();
    }

    if (!apiKey) {
      throw new WaygoInputError("API key cannot be empty.");
    }

    await writeWaygoConfig({ googleMapsApiKey: apiKey });
    outro(`Wrote ${HOME_CONFIG_FILE} (chmod 0600).`);
  },
});
