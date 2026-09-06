/**
 * Auto-flag sync (check branch): bridge from dsh-thinking-levels to the
 * OFFICIAL llm-pi-ai compat surface.
 *
 * CHECK-BRANCH REPLACEMENT: the previous bridge maintained the
 * `llm-openai-completions` takeover list of the dsh-llm-openai-completions
 * adapter plugin (the short-circuit route). Since dsh v0.1.0-rc.8 the official
 * `compat.supportsDeveloperRole` flag (commit 884f7b9c41) fixes the developer
 * role 400 declaratively, so the short-circuit list is no longer needed: the
 * sync now writes the flag into the OFFICIAL `llm-pi-ai` namespace instead.
 *
 * Storage pattern learned from hytime/dsh-thinking-effort's host side
 * (src/host/settings.ts): read the live section → pure transform with
 * immutable clones → `settings.update('llm-pi-ai', { providers })` whole-section
 * writeback, so dsh's `llm-pi-ai` schema validator (assertServiceable) gates
 * the write where it is WRITTEN (settings-rejected names route and model)
 * instead of storing something the reader cannot serve. The flag is written at
 * the ROUTE level (`providers.<route>.compat`) — the official inheritance chain
 * (model → provider → catalog → protocol) means a model-level explicit value
 * still wins, and explicit values are never clobbered by this sync.
 *
 * Identification is unchanged: a provider that (a) targets a custom
 * openai-completions gateway and (b) declares thinking (a reasoningEfforts
 * table) is exactly the route the short-circuit used to take over. Pure
 * functions here are unit-tested; the host plugin wires them to the settings
 * service.
 *
 * Deliberately soft-coupled: nothing here value-imports dsh-settings. If the
 * installed dsh predates rc.8 the schema rejects the unknown field and the
 * host catches and logs the rejection — no error, no log spam.
 * @module dsh-thinking-levels/takeover-sync
 */

/** The settings namespace holding the provider/model configs (llm-pi-ai). */
export const PI_AI_NAMESPACE = 'llm-pi-ai'

/** The settings namespace of the retired short-circuit adapter, still READ to gate posture. */
export const TAKEOVER_NAMESPACE = 'llm-openai-completions'

/** One model row of the llm-pi-ai section (minimal face). */
export interface PiAiModelRow {
  id?: unknown
  reasoningEfforts?: unknown
}

/** One provider profile of the llm-pi-ai section (minimal face). */
export interface PiAiProviderProfile {
  api?: unknown
  baseURL?: unknown
  models?: unknown
  compat?: unknown
  /** Other profile fields (apiKeyEnv, displayName, …) exist but are unused. */
  [key: string]: unknown
}

/** The llm-pi-ai section slice this module reads and transforms. */
export interface PiAiSection {
  providers?: Record<string, PiAiProviderProfile>
}

/** Hosts that are NOT a custom gateway (official OpenAI-compatible endpoints). */
const OFFICIAL_HOST_RE = /(?:^|\.)(?:deepseek\.com|openai\.com|openrouter\.ai|anthropic\.com|googleapis\.com|ai\.google\.dev|mistral\.ai|x\.ai)$/i

/** Whether a value looks like a declared reasoningEfforts table. */
function isEffortsTable(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Whether a provider profile targets a CUSTOM openai-completions gateway:
 * explicit `api: openai-completions`, or a baseURL that is not an official
 * host. Catalog routes without either (e.g. xiaomi via pi-ai discovery) are
 * not custom and are left alone.
 * @param profile - the provider profile slice.
 * @returns true when the route is a custom openai-completions gateway.
 */
export function isCustomOpenAiGateway(profile: PiAiProviderProfile | undefined): boolean {
  if (profile === undefined) return false
  if (profile.api === 'openai-completions') return true
  const baseURL = profile.baseURL
  if (typeof baseURL !== 'string' || baseURL.length === 0) return false
  try {
    return !OFFICIAL_HOST_RE.test(new URL(baseURL).hostname)
  } catch {
    return false
  }
}

/** The model rows a profile declares, from models[] then modelOverrides (effort's modelRows pattern). */
function modelRows(profile: PiAiProviderProfile): PiAiModelRow[] {
  const rows: PiAiModelRow[] = []
  if (Array.isArray(profile.models)) {
    rows.push(...profile.models.filter((row): row is PiAiModelRow => typeof row === 'object' && row !== null))
  }
  if (typeof profile.modelOverrides === 'object' && profile.modelOverrides !== null && !Array.isArray(profile.modelOverrides)) {
    rows.push(...Object.values(profile.modelOverrides).filter((row): row is PiAiModelRow => typeof row === 'object' && row !== null))
  }
  return rows
}

/**
 * Whether a provider declares thinking: at least one model row carries a
 * reasoningEfforts table (thinking on). `false` (thinking off) and absent
 * both mean no thinking.
 * @param profile - the provider profile slice.
 * @returns true when any model declares a reasoningEfforts table.
 */
export function declaresThinking(profile: PiAiProviderProfile | undefined): boolean {
  if (profile === undefined) return false
  return modelRows(profile).some((row) => isEffortsTable(row.reasoningEfforts))
}

/**
 * Identify the providers that should be taken over by the openai-completions
 * adapter: custom gateway AND thinking declared. Order is stable (the section's
 * own provider order).
 * @param section - the live llm-pi-ai section.
 * @returns the provider ids to add to the takeover list.
 */
export function identifyTakeoverProviders(section: PiAiSection | undefined): string[] {
  const providers = section?.providers
  if (typeof providers !== 'object' || providers === null) return []
  return Object.entries(providers)
    .filter(([, profile]) => isCustomOpenAiGateway(profile) && declaresThinking(profile))
    .map(([id]) => id)
}

/**
 * Compute the llm-pi-ai section with the official
 * `compat.supportsDeveloperRole: false` flag written at the ROUTE level for
 * every identified provider (custom openai-completions gateway AND thinking
 * declared) that does not already carry an explicit flag value.
 *
 * Semantics (learned from dsh-thinking-effort's storage handling):
 * - Only the route-level `providers.<route>.compat` is written; model rows
 *   (models[] / modelOverrides) are never touched — the official inheritance
 *   chain keeps a model-level explicit value authoritative.
 * - An EXPLICIT value (true or false) on any layer is respected and left
 *   alone; only an ABSENT route-level flag is filled with `false`. This keeps
 *   the sync idempotent and never overrides user intent.
 * - Immutable: unchanged profiles and the unchanged section are returned by
 *   reference, so the host can skip the write on identity.
 * @param section - the live llm-pi-ai section.
 * @returns the next section, or the previous value (identity) when no change.
 */
export function withDeveloperRoleDisabled(
  section: PiAiSection | undefined,
): PiAiSection | undefined {
  const providers = section?.providers
  if (typeof providers !== 'object' || providers === null) return section
  let nextProviders: Record<string, PiAiProviderProfile> | undefined
  for (const [id, profile] of Object.entries(providers)) {
    if (!isCustomOpenAiGateway(profile) || !declaresThinking(profile)) continue
    const explicit = (profile.compat as Record<string, unknown> | undefined)?.['supportsDeveloperRole']
    if (explicit !== undefined) continue
    nextProviders ??= { ...providers }
    nextProviders[id] = {
      ...profile,
      compat: { ...(typeof profile.compat === 'object' && profile.compat !== null ? profile.compat as Record<string, unknown> : {}), supportsDeveloperRole: false },
    }
  }
  return nextProviders === undefined ? section : { ...section, providers: nextProviders }
}

/**
 * The providers the openai-completions adapter is currently set up to take
 * over, from the live `llm-openai-completions` settings namespace. Used to
 * gate thinking-levels' own behavior: a route OUTSIDE the takeover list is
 * served by pi-ai with its native reasoning semantics (off/high visible,
 * pi-ai validates and serializes the effort) and must not be folded into an
 * Off/On toggle or have efforts injected by this plugin.
 * @param section - the live llm-openai-completions section, if registered.
 * @returns the provider ids the adapter will serve, or `null` when the
 *   namespace is unregistered (adapter plugin absent).
 */
export function takeoverProvidersOf(
  section: { enabled?: unknown; providers?: unknown } | undefined,
): string[] | null {
  if (section === undefined) return null
  if (section.enabled !== true) return []
  if (!Array.isArray(section.providers)) return []
  return section.providers.filter((id): id is string => typeof id === 'string')
}
