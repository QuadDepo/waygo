#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { defineCommand, runCommand, showUsage } from "citty";

import { aliasCommand, initCommand, placesCommand, tripCommand } from "./commands";
import { WaygoCancelledError, WaygoError } from "./errors";
import { printJsonError } from "./output";
import { isJsonMode } from "./runtime";

function resolveCliVersion(): string {
  const npmVersion = process.env.npm_package_version?.trim();
  if (npmVersion) {
    return npmVersion;
  }

  let cursor = dirname(fileURLToPath(import.meta.url));

  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = join(cursor, "package.json");
    if (existsSync(candidate)) {
      try {
        const parsed = JSON.parse(readFileSync(candidate, "utf8")) as { version?: string };
        if (parsed.version) {
          return parsed.version;
        }
      } catch {
        break;
      }
    }

    const parent = dirname(cursor);
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }

  return "0.0.0";
}

const cliVersion = resolveCliVersion();

const main = defineCommand({
  meta: {
    name: "waygo",
    version: cliVersion,
    description: "Google Maps public transit trip planning from the terminal",
  },
  subCommands: {
    trip: tripCommand,
    t: tripCommand,
    places: placesCommand,
    p: placesCommand,
    init: initCommand,
    alias: aliasCommand,
  },
});

function failWith(error: unknown): never {
  if (isJsonMode()) {
    printJsonError(error);
    process.exit(error instanceof WaygoCancelledError ? 130 : 1);
  }

  if (error instanceof WaygoCancelledError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(130);
  }

  if (error instanceof WaygoError) {
    process.stderr.write(`${error.message}\n`);
    if (error.hint) {
      process.stderr.write(`Hint: ${error.hint}\n`);
    }
    process.exit(1);
  }

  if (error instanceof Error) {
    process.stderr.write(`${error.message}\n`);
    if (process.env.WAYGO_DEBUG && error.stack) {
      process.stderr.write(`${error.stack}\n`);
    }
    process.exit(1);
  }

  process.stderr.write(`Unexpected error: ${String(error)}\n`);
  process.exit(1);
}

const rawArgs = process.argv.slice(2);

try {
  if (rawArgs.length === 0 || rawArgs.includes("--help") || rawArgs.includes("-h")) {
    await showUsage(main);
    process.exit(0);
  }

  if (rawArgs.length === 1 && rawArgs[0] === "--version") {
    process.stdout.write(`${cliVersion}\n`);
    process.exit(0);
  }

  await runCommand(main, { rawArgs });
} catch (error) {
  failWith(error);
}
