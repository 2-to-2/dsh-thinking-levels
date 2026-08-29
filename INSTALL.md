# Installation Guide (Official DSH CLI)

This guide uses only the official DSH `dsh plugin` command. The command installs the dependency into a profile and synchronizes `dsh.profile.bundles`. Do not replace it with plain `npm install`, direct `pnpm add` in the profile, or manual edits to the profile manifest.

- [English installation guide](./INSTALL.md)
- [中文安装指南](./INSTALL.zh.md)
- [日本語インストールガイド](./INSTALL.ja.md)
- [한국어 설치 안내](./INSTALL.ko.md)
- [English README](./README.md)
- [中文 README](./README.zh.md)
- [日本語 README](./README.ja.md)
- [한국어 README](./README.ko.md)
- [Changelog](./CHANGELOG.md)
- [日本語 changelog](./CHANGELOG.ja.md)
- [한국어 changelog](./CHANGELOG.ko.md)

The placeholders in this guide are:

- `<profile>`: the DSH profile to modify, usually `web`;
- `dsh-thinking-levels`: the npm package and runtime plugin ID;
- `thinking-levels`: the Cordis composition and settings Slot ID.

## 0. Prerequisites and profile discovery

```bash
echo "DSH_HOME=${DSH_HOME:-$HOME/.dsh}"
dsh --version
ls "${DSH_HOME:-$HOME/.dsh}/profiles"
```

Use the profile named by your running DSH process. `web` is common, but the active `--profile` argument is authoritative.

## 1. Official installation

Install the latest version:

```bash
dsh plugin --profile <profile> add dsh-thinking-levels -w
```

(The `-w` flag is required when the profile is a pnpm workspace root, as `web` is.)

Install the current release explicitly:

```bash
dsh plugin --profile <profile> add dsh-thinking-levels@0.6.0 -w
```

The official CLI updates the profile dependency, lockfile, and `dsh.profile.bundles` automatically. Do not add a manual YAML row.

### Supply-chain cooling period

The dsh runtime uses pnpm 11, whose `minimumReleaseAge` policy may block a freshly published
version with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`. Add the version to
`minimumReleaseAgeExclude` in `~/.dsh/profiles/web/pnpm-workspace.yaml`:

```yaml
minimumReleaseAgeExclude:
  - dsh-thinking-levels@0.6.0
```

## 2. Upgrade

Upgrade to the latest registry version:

```bash
dsh plugin --profile <profile> update dsh-thinking-levels -w
```

Restart DSH for host changes and refresh the Web page for client changes.

## 3. Local-path / link: registration (alternative)

For development or offline installs, register the plugin from a local checkout:

```bash
#    ~/.dsh/profiles/web/package.json dependencies:
#      "dsh-thinking-levels": "link:<absolute path to dsh-thinking-levels>"
#    ~/.dsh/profiles/web/cordis.patch.yml:
#      - insert:
#          - id: thinking-levels
#            name: dsh-thinking-levels
cd ~/.dsh/profiles/web && pnpm install && dsh web
```

Or use the official CLI with a local path (no network needed):

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-thinking-levels -w
```

## 4. Verify installation

Check the dependency and installed version:

```bash
grep -n "dsh-thinking-levels" \
  "${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/package.json"
node -p "require('${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/node_modules/dsh-thinking-levels/package.json').version"
```

The version must be `0.6.0` for this release.

Check the official composition:

```bash
dsh --profile <profile> --dump-default-config
```

It must contain:

```yaml
- id: thinking-levels
  name: dsh-thinking-levels
```

## 5. Verify the settings card

Restart DSH, then refresh the Web page. Open **Settings → Plugins → configurable plugins** and expand the **Thinking Levels** card.

1. The level picker offers the eight standard levels plus `auto`; the scheduler toggles sit below.
2. The model-capabilities block groups providers; each model row shows text/image badges and a declared context window, and expands into the per-level editor.
3. Tick a level and enter its gateway wire value (e.g. `high` → `ultra`), then press **Apply levels**. `off` left empty means "do not send".
4. The search box filters models; the official / generic presets apply to every thinking model.

## Japanese and Korean support status

The plugin ships `ja` and `ko` dictionaries, but the current official DSH release exposes only `zh` and `en` through `LocaleRuntime`. On stock DSH, selecting Japanese or Korean fails with `locale "<id>" is not registered`.

To use them before official support lands, maintain a DSH fork and update:

- `packages/client/locale/src/locale-settings.ts`: add `ja` and `ko` to `LOCALE_IDS` (the Host preference schema derives from this list).
- `packages/client/locale/src/client/index.ts`: add `{ id: 'ja', label: '日本語' }` and `{ id: 'ko', label: '한국어' }` to `LOCALES`.
- Add the corresponding core dictionaries and tests, then rebuild and run the forked DSH.

A plugin-only change cannot extend DSH's global locale list. Use the fork's documented build and official profile commands; do not manually edit a profile manifest.

## 6. Troubleshooting

| Symptom | Action |
| --- | --- |
| `dsh` is not found | Install or enable the official DSH CLI. Do not simulate profile installation with plain npm or pnpm commands. |
| `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | Add the version to `minimumReleaseAgeExclude` in the profile's `pnpm-workspace.yaml`. |
| Plugin shows as "disabled/unmounted" with no error | Check the profile composition; the host must not value-depend on `@deepseek-ai/dsh-settings` (it does not). |
| Client entry missing from `__DSH_BOOT__` | Confirm `exports["./client"]` exists and the host fiber was established. |
| Model selector has no `Auto` | Confirm the adapter `resolveModel` wrapper ran (it re-runs on `llm/adapters-updated`). |
| Settings card write fails | The value was rejected by the llm-pi-ai schema (e.g. a `reasoningEfforts` table with no thinking level). Check the entered values. |
| Subagent returns `UNSUPPORTED_REASONING_EFFORT` | The target model does not advertise the level; pick a supported one or restore the provider default. |
| Stale client bundle | Hard-refresh the browser (Ctrl+Shift+R) after an upgrade. |

## 7. Remove

Use the official command:

```bash
dsh plugin --profile <profile> remove dsh-thinking-levels -w
```

Verify that the composed profile no longer contains the bundle:

```bash
dsh --profile <profile> --dump-default-config
```
