# waygo

> Google Maps public transit directions in your terminal.

`waygo` is a small CLI that wraps Google's Routes API (`computeRoutes` with `TRANSIT`) and Places API (Text Search) so you can plan a trip from the command line:

```sh
waygo trip "Centraal Amsterdam" "Schiphol Airport" --depart-at "+15m"
waygo places "Eiffel Tower" --json
```

## Install

```sh
npm i -g waygo          # or: bun add -g waygo / pnpm add -g waygo
```

Requires Node `>= 18`.

## Setup

You need a Google Maps Platform API key with the **Routes API** and **Places API (New)** enabled.

Pick one:

- **Interactive (recommended)** — `waygo init` prompts for the key and writes `~/.config/waygo/config.json` with mode `0600`.
- **Env var** — set `GOOGLE_MAPS_API_KEY` in your shell or a `.env` next to where you run waygo.
- **Hand-write the config** — see [Config file](#config-file) below.

## Commands

### `waygo trip [from] [to]` (alias: `t`)

Plan transit directions.

```sh
waygo trip                                            # fully interactive
waygo trip "Amsterdam Centraal" "Schiphol Airport"
waygo trip home work --depart-at "tomorrow 08:30"     # uses aliases
waygo trip A B --arrive-by "18:00" --prefer fewer-transfers
waygo trip A B --json                                 # script-friendly
```

Time flags accept any of:

| Form                  | Example                         |
| --------------------- | ------------------------------- |
| Relative keyword      | `now`                           |
| Relative offset       | `+15m`, `+2h`, `+1d`            |
| Clock today           | `14:30`, `today 14:30`          |
| Clock tomorrow        | `tomorrow 08:30`                |
| Date + clock          | `2026-06-01 09:00`              |
| Date only             | `2026-06-01` (with `--date`)    |
| ISO 8601              | `2026-06-01T09:00:00+02:00`     |

Use `--prefer less-walking` or `--prefer fewer-transfers` to bias the routing.

### `waygo places <query>` (alias: `p`)

Search Google Places (Text Search).

```sh
waygo places "Eiffel Tower"
waygo places "coffee in Utrecht" --json
```

### `waygo init`

Write `~/.config/waygo/config.json` with mode `0600`. Pass `--api-key <KEY>` to skip the prompt, `--force` to overwrite an existing file.

## Config file

`~/.config/waygo/config.json`:

```json
{
  "googleMapsApiKey": "AIza...",
  "placeSearchLimit": 5,
  "aliases": {
    "home": "Damrak 1, Amsterdam",
    "work": "Stationsplein 9, Utrecht"
  }
}
```

Resolution order (first match wins):

1. CWD `waygo.config.{ts,mjs,json}` (via [c12](https://github.com/unjs/c12))
2. `~/.config/waygo/config.{ts,mjs,json}`
3. `GOOGLE_MAPS_API_KEY` env var (also read from a local `.env`)

## Output

- **Human mode (default)** — interactive selection of routes, colored line badges, a clean timeline of departures, walks, and arrivals.
- **JSON mode (`--json` / `-j`)** — structured, scriptable output. Errors are emitted as `{ "error": "..." }` on stdout with a non-zero exit code.

Set `NO_COLOR=1` to disable ANSI colors. Set `WAYGO_DEBUG=1` to print stack traces on unexpected errors.

## Exit codes

| Code | Meaning                          |
| ---- | -------------------------------- |
| 0    | Success                          |
| 1    | Error (input, config, API, etc.) |
| 130  | User cancelled an interactive prompt |

## Development

```sh
bun install
bun run dev trip "Amsterdam Centraal" "Utrecht Centraal"
bun run test
bun run typecheck
bun run lint
bun run knip          # find unused exports
bun run build
```

Tests use [Vitest](https://vitest.dev). Lefthook runs lint + typecheck on pre-commit.

## License

MIT
