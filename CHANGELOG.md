# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Until `1.0.0`, breaking changes may land in minor releases.

## [Unreleased]

## [0.1.0] — 2026-05-23

### Added
- `trip` command for Google Maps transit directions (interactive + scriptable, JSON output).
- `places` command for Google Places text search.
- `init` command that writes `~/.config/waygo/config.json` with mode `0600`.
- Custom error hierarchy (`WaygoError`, `WaygoApiError`, `WaygoConfigError`, `WaygoInputError`, `WaygoCancelledError`) with user-facing hints.
- Global error handler that prints a hint instead of a stack trace; `WAYGO_DEBUG=1` re-enables stacks.
- Retry/backoff with `Retry-After` honoring on Google API calls (3 attempts, jittered exponential).
- Flexible time grammar for `--depart-at` / `--arrive-by`: `now`, `+30m`, `+2h`, `+1d`, `tomorrow 09:00`, `today 18:00`, `YYYY-MM-DD HH:MM`, ISO 8601.
- Place aliases in config (`home`, `work`, etc.).
- Vitest test suite covering pure modules.

[Unreleased]: https://github.com/your-org/waygo/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/your-org/waygo/releases/tag/v0.1.0
