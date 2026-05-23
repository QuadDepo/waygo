import { intro, isCancel, outro, select, text } from "@clack/prompts";
import { defineCommand } from "citty";

import { HOME_CONFIG_FILE, mutateHomeConfig, readRawConfig } from "../config";
import { WaygoCancelledError, WaygoInputError } from "../errors";
import { printJson } from "../output";
import { setJsonMode } from "../runtime";
import { getArgString } from "../utils/args";

function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase();
}

async function readAliases(): Promise<Record<string, string>> {
  const config = await readRawConfig();
  return config?.aliases ?? {};
}

async function renderAliasList(jsonMode: boolean): Promise<void> {
  const aliases = await readAliases();

  if (jsonMode) {
    printJson({ aliases });
    return;
  }

  const entries = Object.entries(aliases).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) {
    process.stdout.write("No aliases configured. Add one with: waygo alias add <key> <value>\n");
    return;
  }

  const width = Math.max(...entries.map(([k]) => k.length));
  for (const [key, value] of entries) {
    process.stdout.write(`${key.padEnd(width)}  ${value}\n`);
  }
}

const aliasAddCommand = defineCommand({
  meta: {
    name: "add",
    description: "Add or overwrite an alias",
  },
  args: {
    key: { type: "positional", description: "Alias name", required: false },
    value: { type: "positional", description: "Place query or placeId:ChIJ...", required: false },
  },
  async run(context) {
    setJsonMode(false);
    intro("waygo alias add");

    let keyArg = getArgString(context.args.key);
    if (!keyArg) {
      const answer = await text({
        message: "Alias name (e.g. home)",
        validate: (v) => (v && v.trim().length > 0 ? undefined : "Name cannot be empty."),
      });
      if (isCancel(answer)) throw new WaygoCancelledError();
      keyArg = answer.trim();
    }
    const key = normalizeKey(keyArg);
    if (!key) throw new WaygoInputError("Alias name cannot be empty.");

    let value = getArgString(context.args.value);
    if (!value) {
      const answer = await text({
        message: `Place for "${key}" (address, place name, or placeId:ChIJ...)`,
        validate: (v) => (v && v.trim().length > 0 ? undefined : "Value cannot be empty."),
      });
      if (isCancel(answer)) throw new WaygoCancelledError();
      value = answer.trim();
    }

    const previous = (await readAliases())[key];

    const next = await mutateHomeConfig((cfg) => ({
      ...cfg,
      aliases: { ...cfg.aliases, [key]: value },
    }));

    const message =
      previous && previous !== value
        ? `Updated "${key}": "${previous}" -> "${value}"`
        : `Set "${key}" -> "${value}"`;
    outro(
      `${message}\nWrote ${HOME_CONFIG_FILE} (${Object.keys(next.aliases ?? {}).length} alias(es)).`,
    );
  },
});

const aliasListCommand = defineCommand({
  meta: {
    name: "list",
    description: "List configured aliases",
  },
  args: {
    json: { type: "boolean", alias: "j", description: "Output JSON", default: false },
  },
  async run(context) {
    const jsonMode = Boolean(context.args.json);
    setJsonMode(jsonMode);
    await renderAliasList(jsonMode);
  },
});

const aliasRmCommand = defineCommand({
  meta: {
    name: "rm",
    description: "Remove an alias",
  },
  args: {
    key: { type: "positional", description: "Alias name", required: false },
  },
  async run(context) {
    setJsonMode(false);
    intro("waygo alias rm");

    const current = await readAliases();
    const keys = Object.keys(current);
    if (keys.length === 0) {
      outro("No aliases configured.");
      return;
    }

    let keyArg = getArgString(context.args.key);
    if (!keyArg) {
      const picked = await select({
        message: "Remove which alias?",
        options: keys.sort().map((k) => ({ value: k, label: k, hint: current[k] })),
      });
      if (isCancel(picked)) throw new WaygoCancelledError();
      keyArg = String(picked);
    }
    const key = normalizeKey(keyArg);

    if (!(key in current)) {
      throw new WaygoInputError(`Unknown alias "${key}".`, {
        hint: keys.length > 0 ? `Known: ${keys.sort().join(", ")}` : undefined,
      });
    }

    const previousValue = current[key];
    await mutateHomeConfig((cfg) => {
      const next = { ...cfg.aliases };
      delete next[key];
      return { ...cfg, aliases: next };
    });

    outro(`Removed "${key}" (was "${previousValue}").`);
  },
});

const ALIAS_SUBCOMMANDS = new Set(["add", "list", "ls", "rm", "remove"]);

export const aliasCommand = defineCommand({
  meta: {
    name: "alias",
    description: "Manage place aliases in ~/.config/waygo/config.json",
  },
  subCommands: {
    add: aliasAddCommand,
    list: aliasListCommand,
    ls: aliasListCommand,
    rm: aliasRmCommand,
    remove: aliasRmCommand,
  },
  async run(context) {
    // citty also fires the parent's run when a subcommand matches; skip if so.
    const firstArg = context.rawArgs?.find((arg) => !arg.startsWith("-"));
    if (firstArg && ALIAS_SUBCOMMANDS.has(firstArg)) {
      return;
    }
    setJsonMode(false);
    await renderAliasList(false);
  },
});
