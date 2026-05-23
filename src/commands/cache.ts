import { defineCommand } from "citty";

import { CACHE_FILE, clearCache } from "../cache";
import { setJsonMode } from "../runtime";

const CACHE_SUBCOMMANDS = new Set(["clear"]);

const cacheClearCommand = defineCommand({
  meta: {
    name: "clear",
    description: "Delete the local place-ID cache",
  },
  async run() {
    setJsonMode(false);
    const removed = await clearCache();
    process.stdout.write(
      removed
        ? `Cleared ${CACHE_FILE}.\n`
        : `Nothing to clear (no cache file at ${CACHE_FILE}).\n`,
    );
  },
});

export const cacheCommand = defineCommand({
  meta: {
    name: "cache",
    description: "Manage the local place-ID cache (~/.config/waygo/cache.json)",
  },
  subCommands: {
    clear: cacheClearCommand,
  },
  async run(context) {
    const firstArg = context.rawArgs?.find((arg) => !arg.startsWith("-"));
    if (firstArg && CACHE_SUBCOMMANDS.has(firstArg)) {
      return;
    }
    setJsonMode(false);
    process.stdout.write(
      "Usage: waygo cache clear\n  Removes ~/.config/waygo/cache.json.\n",
    );
  },
});
