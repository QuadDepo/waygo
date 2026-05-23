---
name: waygo
description: Plan Google Maps public transit trips and look up places from the terminal via the `waygo` CLI. Use when the user asks for transit/public-transport directions (train/bus/tram/subway), wants to find a place's address or coordinates, asks "how do I get from A to B by transit", says things like "at what time should I leave to be at X by Y", wants to save / list / remove a frequent place ("save my home address as an alias"), wants scriptable JSON output of routes or places, or asks about the `waygo` / `waygo trip` / `waygo places` / `waygo alias` / `waygo cache` commands. Covers config setup (env var vs. `~/.config/waygo/config.json` via `waygo init`), the flexible time grammar (`+30m`, `tomorrow 09:00`, ISO), place aliases (incl. `placeId:` direct-pin shortcut), the place-ID cache (`~/.config/waygo/cache.json`) and how to bypass it (`--no-cache`, `waygo cache clear`), JSON mode for scripting, and the three error categories (config, input, API). Don't use for driving directions, walking-only routes, real-time vehicle tracking, or non-Google map providers — this CLI only calls Google's Routes API (TRANSIT) and Places API (New).
---

# waygo — Google Maps transit + places CLI

`waygo` wraps Google's **Routes API** (`travelMode: TRANSIT`) and **Places API (New)** Text Search. Install with `npm i -g waygo`.

## Subcommands

| Command | Alias | Purpose |
| --- | --- | --- |
| `waygo trip [from] [to]` | `waygo t` | Plan transit directions A → B |
| `waygo places <query>` | `waygo p` | Resolve a place name to address, place ID, coordinates |
| `waygo init` | — | Write `~/.config/waygo/config.json` with mode 0600 |
| `waygo alias add|list|rm` | `ls`, `remove` | Manage place aliases (saved locations) |
| `waygo cache clear` | — | Delete `~/.config/waygo/cache.json` |

Bare `waygo` (no subcommand) prints help — it does **not** start an interactive trip. Use `waygo trip` for that. Run `waygo <cmd> --help` for the canonical flag list.

## Flags

### `waygo trip`

| Flag | Type | Notes |
| --- | --- | --- |
| `[from]`, `[to]` | positional | Place name, address, or alias. Prompted if missing. |
| `--depart-at <time>` | time grammar | See [Time grammar](#time-grammar). Mutually exclusive with `--arrive-by`. |
| `--arrive-by <time>` | time grammar | Same grammar as above. |
| `--date YYYY-MM-DD` | date | Anchor for bare `HH:MM` values. Alone: depart today at current clock on that date. |
| `--prefer <mode>` | enum | `less-walking` or `fewer-transfers`. Citty rejects anything else. Omit for Google default. |
| `--json` / `-j` | bool | Emit JSON to stdout; suppress prompts and decorations. |
| `--no-cache` | bool | Bypass `~/.config/waygo/cache.json` reads + writes for this run. |

### `waygo places`

| Flag | Type | Notes |
| --- | --- | --- |
| `<query>` | positional | Free-text. Prompted if missing. |
| `--json` / `-j` | bool | Emit JSON. |

### `waygo init`

| Flag | Type | Notes |
| --- | --- | --- |
| `--api-key <key>` | string | Skip the prompt (useful in scripts: `waygo init --api-key "$KEY"`). |
| `--force` | bool | Overwrite an existing config file without confirming. |

### `waygo alias`

| Subcommand | Args | Notes |
| --- | --- | --- |
| `add <key> <value>` | both prompted if missing | Silent overwrite; previous value printed in the outro. Always writes to `~/.config/waygo/config.json`. |
| `list` (alias `ls`) | `--json` | Sorted table. Empty list prints a one-liner with the add-command hint. |
| `rm <key>` (alias `remove`) | key prompted via picker if missing | Errors with `Unknown alias "<key>".` when the key isn't configured. |

Keys are lowercased + trimmed. Values can be **any** Places-API-resolvable string (address, landmark, business name) or a `placeId:ChIJ...` prefix that skips lookup. Bare `waygo alias` prints the list (same as `waygo alias list`).

## First-run setup

Pick **one**:

1. **Recommended:** `waygo init` — prompts for the API key, writes `~/.config/waygo/config.json` (`chmod 0600`). Works from any cwd afterwards.
2. **Env var:** `export GOOGLE_MAPS_API_KEY=AIza...` (also read from a local `.env`).

The key needs **Routes API** and **Places API (New)** enabled on the same Google Cloud project. Other Maps APIs (Geocoding, legacy Directions, legacy Places) are *not* required and *will not* substitute.

When the user is configuring a key from scratch, recommend **API restriction** (Routes API + Places API (New) only). IP- or website-based restrictions don't work — the CLI runs on end-user machines, sends no `Referer`, and end-user IPs are dynamic.

## Time grammar

`--depart-at` and `--arrive-by` accept the same forms. Use one or the other, **never both** in one invocation.

| Form | Example | Notes |
| --- | --- | --- |
| Keyword | `now` | Same as omitting the flag |
| Offset | `+15m`, `+2h`, `+1d` | Relative to current moment (units: `m`, `h`, `d` only — no `+30min`) |
| Clock today | `14:30`, `today 14:30` | Machine local timezone |
| Clock tomorrow | `tomorrow 08:30` | Machine local timezone |
| Bare day | `tomorrow`, `today` | Carries current clock |
| Date + clock | `2026-06-01 09:00` | Machine local timezone |
| Date alone | `2026-06-01` | Treated as 00:00, or combine with `--date` for HH:MM |
| ISO 8601 | `2026-06-01T09:00:00+02:00` | Honors explicit offset |

Values without an explicit offset are interpreted in the **machine's local timezone**. Agents running on UTC servers should pass full ISO 8601 to be unambiguous.

## Common workflows

### Find a place / address

```sh
waygo places "Amsterdam Centraal"
waygo places "Eiffel Tower" --json
waygo p "Utrecht Centraal"
```

The CLI auto-narrows to a single result when one match clearly wins; otherwise it shows a picker (or, in `--json` mode, errors with `Ambiguous place "<query>". Candidates: <up to 3 hints>`).

### Plan a transit trip

```sh
waygo trip "Amsterdam Centraal" "Schiphol Airport"
waygo trip "Amsterdam Centraal" "Schiphol Airport" --depart-at "+30m"
waygo trip A B --arrive-by "tomorrow 09:00"
waygo trip A B --prefer fewer-transfers
waygo trip                                    # fully interactive
```

### Script-friendly output

```sh
waygo trip A B --depart-at "+1h" --json | jq '.[0].durationSeconds'
waygo places "Utrecht Centraal" --json | jq -r '.places[0].placeId'
```

### Aliases (saved locations)

Manage via the dedicated subcommand — don't hand-edit the config file unless the user explicitly wants to:

```sh
waygo alias add home "Damrak 1, Amsterdam"
waygo alias add work "placeId:ChIJ..."        # pin to a specific Place ID
waygo alias list
waygo alias rm home
```

Then use the key as a positional: `waygo trip home work --depart-at "+15m"`. Lookup is case-insensitive; an unmatched key falls through to a regular text query. Aliases are stored under `aliases` in `~/.config/waygo/config.json`.

### Place-ID cache

After a successful place resolution (Routes-API call needs a place ID), the resolved record is cached in `~/.config/waygo/cache.json` (mode `0600`) keyed by the normalized query. The next `waygo trip` with the same `from`/`to` skips Places API entirely, typically halving wall-clock time.

- The cache has **no TTL**. Place IDs are stable per Google's docs.
- Ambiguous results are **not cached** — only clear-winner resolutions are.
- `--no-cache` on `waygo trip` bypasses reads + writes for one run (use when troubleshooting a stale entry).
- `waygo cache clear` deletes the file. Idempotent (no-op if missing).
- The cache is **read at the start** of every trip-side place resolve and **written after** a clear-winner hit.

### Direct `placeId:` shortcut

Any place value (CLI arg or alias value) starting with `placeId:` is treated as the literal Place ID, **skipping** the Places API call. Use when an agent already has the ID from a prior `waygo places --json` call, or when an alias should be pinned beyond rename-drift of the underlying address.

```sh
waygo trip "placeId:ChIJIxbYDbcJxkcRQtHfOo0b58o" "Schiphol Airport"
waygo alias add home "placeId:ChIJ..."        # pin in alias
```

`displayName` and `formattedAddress` in JSON output will be the literal `placeId:<id>` string in this path (Routes API still produces real stop names in the route timeline).

## JSON output shapes

### `waygo places --json`

```ts
{
  query: string,
  places: [
    {
      placeId: string,          // canonical ID
      name?: string,            // Google internal "places/<id>" form
      displayName: string,
      formattedAddress: string,
      primaryType?: string,     // e.g. "train_station"
      types: string[],          // all type tags
      location?: { latitude: number, longitude: number }
    }
  ]
}
```

### `waygo trip --json`

Top-level is an **array** of routes.

```ts
[
  {
    index: number,                       // 1-based
    durationSeconds?: number,
    distanceMeters?: number,
    fare?: { currencyCode: string, amount: number },
    legs: [
      {
        departureTime?: string,          // ISO 8601 from Google (parseISO-safe)
        arrivalTime?: string,
        steps: [
          // Either:
          { type: "walk",
            instruction?: string,
            durationSeconds?: number,
            distanceMeters?: number },
          // …or:
          { type: "transit",
            departureTime?: string,
            arrivalTime?: string,
            departureStop?: string,
            arrivalStop?: string,
            headsign?: string,
            lineName?: string,
            lineShortName?: string,
            tripShortText?: string,
            lineColor?: string,
            lineTextColor?: string,
            vehicleType?: string,        // e.g. "HEAVY_RAIL", "BUS"
            vehicleName?: string,
            stopCount?: number,
            durationSeconds?: number,
            distanceMeters?: number }
        ]
      }
    ]
  }
]
```

`departureTime` / `arrivalTime` are whatever ISO 8601 strings Google returns (commonly `Z`-suffixed, but don't hardcode that — feed them to a real ISO parser).

### Error JSON

In `--json` mode, errors and cancellations print to **stdout** as `{ "error": "<message>" }` with a non-zero exit code. Nothing goes to stderr in JSON mode.

## Output expectations

- **Human mode (default):** clack intros/outros, a route picker, then a colored timeline of stops, line badges, and walk segments. Don't parse this — it has ANSI codes and clack box-drawing. Pass `--json` instead.
- ANSI colors auto-disable when stdout isn't a TTY, or when `NO_COLOR=1` is set.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | Error (config, input, API, validation) |
| `130` | User cancelled an interactive prompt (in JSON mode, stdout still gets `{"error":"Cancelled."}`) |

## Errors and how to react

The error handler prints `<message>` plus a one-line `Hint:` and exits 1. Stack traces are suppressed; `WAYGO_DEBUG=1` re-enables stacks **only for generic `Error`** — typed `WaygoError`s never get a stack regardless. The Google API client retries `408 / 425 / 429 / 5xx` and network errors up to **3 attempts total** with jittered exponential backoff (capped at 30s) and honors `Retry-After`.

- **`Missing Google Maps API key.`** — neither config nor env var has it. Run `waygo init` or export `GOOGLE_MAPS_API_KEY`. Don't write the user's config silently — tell them what to do.
- **`Google places API error (400): API key not valid. Please pass a valid API key.`** — wrong / disabled key, or one of the two required APIs is not enabled. Verify both **Routes API** and **Places API (New)** are on the project (the legacy "Places API" does not count). The hint string will say "Check that GOOGLE_MAPS_API_KEY is set and the Routes + Places (New) APIs are enabled".
- **`Google ... API error (403)`** — key has IP / referrer / app restrictions that block CLI usage. Switch to API restriction only.
- **`Google ... API error (429)`** — retries exhausted. Project quota is too low; raise it in Cloud Console.
- **`Ambiguous place "<query>". Candidates: <displayName (formattedAddress), …>`** — `--json` mode only; query matched multiple places. Re-run more specifically (add city, country) or drop `--json` and let the user pick.
- **`No place found for "<query>".`** — try a more specific query or use the place's official name.
- **`Invalid --depart-at value.` / `Invalid --arrive-by value.`** — the input didn't match the grammar table. Common slips: `+30min` (use `+30m`), missing space in `tomorrow 09:00`.
- **`Use either --depart-at or --arrive-by, not both.`** — pick one. Semantics differ: "leave at X" vs. "arrive by X".
- **`Invalid --date value. Expected YYYY-MM-DD.`** — exactly that format; don't pass slashes or month names.
- **`Invalid --prefer value. Use less-walking or fewer-transfers.`** — citty's `type: "enum"` rejects bad values first; treat the two allowed values as a hard constraint when constructing args programmatically.

## When not to do things

- **Don't try this CLI for driving / walking / cycling.** `travelMode` is hardcoded to `TRANSIT`. Use a different tool for other modes.
- **Don't suggest IP / website restrictions** on the Google API key.
- **Don't recommend committing `.env` or `~/.config/waygo/config.json`.** Both contain the API key.
- **Don't parse human-mode output.** Always `--json` for scripting.
- **Don't pass both `--depart-at` and `--arrive-by`.** The CLI rejects it. If the user describes both, ask which one they actually mean.
- **Don't invent flags.** If a workflow doesn't fit the tables above, run `waygo <cmd> --help` first.
- **Don't hand-edit `~/.config/waygo/config.json`** unless the user asks. Use `waygo alias add|rm` to manage aliases — that path preserves the chmod 0600 invariant and validates JSON before writing.
- **Don't clear the cache "to be safe"** as a default. The cache is correctness-neutral (Place IDs are stable). Only clear on user request or when troubleshooting a known-stale entry, and prefer `--no-cache` for a single run over `waygo cache clear` for a global wipe.
- **Don't store `placeId:` values without the prefix.** Bare `ChIJ...` strings in the alias map are treated as text queries and will round-trip through Places API.
- **Don't query categories in `--json` mode** (e.g. `places "coffee in Utrecht" --json`) and expect a single result — category queries usually trip the Ambiguous-place error. Use a specific name, or drop `--json` so the user can pick.

## Config locations and precedence

```
~/.config/waygo/config.json   # API key + aliases + limits (mode 0600)
~/.config/waygo/cache.json    # place-ID cache (mode 0600, regenerated automatically)
./.env                         # GOOGLE_MAPS_API_KEY only, optional
./waygo.config.{ts,mjs,js,json}   # per-project overrides, optional (c12 cascade)
```

Resolution is a **deep merge** via [c12](https://github.com/unjs/c12): CWD `waygo.config.*` overlays on top of `~/.config/waygo/config.*`. After the merge, `googleMapsApiKey` from the merged file wins; if it's missing, the `GOOGLE_MAPS_API_KEY` env var (incl. `.env`) is used. If "nothing works" after `waygo init`, check the cwd for a stray `waygo.config.json` overriding the home config.
