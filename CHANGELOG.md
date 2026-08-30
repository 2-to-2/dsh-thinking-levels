# Changelog

All notable changes to `dsh-thinking-levels` are documented here.

- [English changelog](./CHANGELOG.md)
- [日本語 changelog](./CHANGELOG.ja.md)
- [한국어 changelog](./CHANGELOG.ko.md)

## [0.7.0] — 2026-08-30

### Added

- **Multi-level context-window presets** in the per-model capability editor: `64K / 128K / 256K / 400K / 512K / 1M` preset buttons plus a custom integer input and clear button, written to the `llm-pi-ai` model `contextWindow` and consumed live by the harness (compaction / context-overflow detection / context-pressure projections) on the next request — no restart needed.
- New pure module `src/context-window.ts` (range constants `2000`–`1_000_000`, preset list, `formatContextWindow`, `validateContextWindow`) shared by the config schema, the settings card and the tests.
- Config surface: `models[].contextWindow` override accepted with integer `2000`–`1000000` validation (fail-loud on out-of-band values).
- New `zh` / `en` / `ja` / `ko` copy for the context-window control.

### Changed

- The context badge now reuses the shared `formatContextWindow` so written presets display exactly (e.g. `256000` → `256K`, `1000000` → `1M`).

## [0.6.0] — 2026-02-?

### Added

- **Eight standard levels** aligned with dsh-thinking-effort: `off / on / minimal / low / medium / high / xhigh / max` (plus the `auto` scheduler mask). `on` is the enable-thinking toggle, clamped to the model's default strength (`high` or the highest advertised thinking level); `minimal` / `medium` / `xhigh` pass through when a custom gateway advertises them and collapse onto `high` on the official adapter.
- **Custom wire mapping in the settings card** (borrowed from dsh-thinking-effort): each level can be ticked and given the exact value sent to the gateway (e.g. `high` → `ultra`); `off` left empty means "do not send". Stored as the model's `reasoningEfforts` table.
- **Settings-card presentation overhaul** (borrowed from dsh-thinking-effort): providers group their models, each model row shows text/image/context badges, models expand into a per-level editor, a search box filters models, and one-click presets (official DeepSeek style / generic) apply to every thinking model.
- **Multilingual**: Japanese (`ja`) and Korean (`ko`) dictionaries, plus `README.ja.md` / `README.ko.md`, `INSTALL.{md,zh,ja,ko}.md`, and `CHANGELOG.{md,ja,ko}.md`. Note: the official DSH locale runtime still exposes only `zh` / `en`, so `ja` / `ko` selection requires a DSH fork (see README compatibility note).

### Changed

- `level` config surface accepts the full nine values (`off | on | minimal | low | medium | high | xhigh | max | auto`).
- `models[].efforts` override accepts the extended levels.
- Card renderer refactored; capability editors now use a staged wire draft with an explicit **Apply levels** button instead of immediate checkbox commits.

### Fixed

- `effortLevelsOf` unused helper removed; legacy `_N` unused-parameter lint warning silenced.

## [0.5.2] — 2026-02-?

### Added

- **Auto-takeover of `dsh-llm-openai-completions`**: providers that are custom openai-completions gateways (`api: openai-completions` or non-official baseURL) **and** declare a `reasoningEfforts` table on any model are merged into `llm-openai-completions.providers` with `enabled: true`. Runs on plugin start, `llm/adapters-updated`, and settings changes; soft-coupled (skips the write when the namespace is unregistered).

## [0.5.1] — 2026-02-?

### Added

- Model-capability editor card: vision / thinking / supports-effort / effort levels / thinking format for every custom `llm-pi-ai` provider model, written straight to the `llm-pi-ai` settings namespace (no official-package changes).

## [0.5.0] — 2026-02-?

### Added

- Model-aware guard: never send `reasoning_effort` to a model that does not advertise it (custom openai-completions routes such as Qwen3.6 are stripped instead).
- `low` passthrough on dsh rc.7+; rc.6-era adapters can advertise `low` via a configurer-confirmed `models` override.
- `models` config section (`provider/model` → `vision` / `thinking` / `efforts`).

## [0.4.1] — 2026-02-?

### Fixed

- Adapter `resolveModel` wrapper now re-runs on `llm/adapters-updated` so the `Auto` mask appears even when adapters register after plugin apply.

## [0.4.0] — 2026-02-?

### Changed

- Removed the value dependency on `@deepseek-ai/dsh-settings`; settings registration goes through the cordis `settings` service (local `installSettingsSection` equivalent).
- Card registration supplies both `id` and `key` so it works on CLI (keyed) and DSH Desktop (list) slot declarations.

## [0.3.0] — 2026-02-?

### Added

- Model-selector `Auto` (mask): injected into adapter `resolveModel` efforts; the plugin schedules `low` / `high` / `max` per step via the `agent/request` waterfall (registered with `prepend` so the session model-selection assembly cannot overwrite it).

## [0.2.1] — 2026-02-?

### Fixed

- Added `exports["./client"]` so the client bundle is discovered by dsh's client-modules loader.

## [0.2.0] — 2026-02-?

### Added

- First client settings card (level picker + scheduler toggles).

## [0.1.1] — 2026-02-?

### Fixed

- Publish compiled `lib/` instead of raw TS sources (Node 22 forbids type-stripping `.ts` under `node_modules`).

## [0.1.0] — 2026-02-?

### Added

- Initial release: `agent/request` injection of a fixed reasoning effort.
