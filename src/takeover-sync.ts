/**
 * Auto-takeover sync: bridge from dsh-thinking-levels to the
 * dsh-llm-openai-completions adapter plugin.
 *
 * The openai-completions adapter takes over streaming for the providers listed
 * in the `llm-openai-completions` settings namespace (`{ enabled, providers }`).
 * Maintaining that list by hand is friction: a user who configures a custom
 * gateway with thinking in `llm-pi-ai` (reasoningEfforts table) must ALSO add
 * the provider to the takeover list or the pi-ai adapter serves the route with
 * the wrong wire behavior (developer role / no enable_thinking).
 *
 * This module closes that gap: it scans the live `llm-pi-ai` section for
 * providers that (a) target a custom openai-completions gateway and (b) declare
 * thinking (a reasoningEfforts table), and computes the `llm-openai-completions`
 * list that would take them over. Pure functions here are unit-tested; the host
 * plugin wires them to the settings service.
 *
 * Deliberately soft-coupled: nothing here value-imports the adapter plugin or
 * dsh-settings. If the `llm-openai-completions` namespace is unregistered (the
 * plugin is not composed), the host skips the write — no error, no log spam.
 * @module dsh-thinking-levels/takeover-sync
 */

/** The settings namespace owned by dsh-llm-openai-completions. */
export const TAKEOVER_NAMESPACE = 'llm-openai-completions'

/** The settings namespace holding the provider/model configs (llm-pi-ai). */
export const PI_AI_NAMESPACE = 'llm-pi-ai'

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
  /** Other profile fields (apiKeyEnv, displayName, …) exist but are unused. */
  [key: string]: unknown
}

/** The llm-pi-ai section slice this module reads. */
export interface PiAiSection {
  providers?: Record<string, PiAiProviderProfile>
}

/** The llm-openai-completions section this module writes. */
export interface TakeoverSection {
  enabled: boolean
  providers: string[]
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

/**
 * Whether a provider declares thinking: at least one model row carries a
 * reasoningEfforts table (thinking on). `false` (thinking off) and absent
 * both mean no thinking.
 * @param profile - the provider profile slice.
 * @returns true when any model declares a reasoningEfforts table.
 */
export function declaresThinking(profile: PiAiProviderProfile | undefined): boolean {
  if (profile === undefined || !Array.isArray(profile.models)) return false
  return profile.models.some((row) => {
    if (typeof row !== 'object' || row === null) return false
    return isEffortsTable((row as PiAiModelRow).reasoningEfforts)
  })
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
 * Compute the next takeover section: the previous user list plus every
 * identified provider (deduped, order preserved), enabled. When nothing
 * changes, the previous section is returned unchanged (identity — the host
 * compares before writing).
 * @param previous - the current llm-openai-completions value, if registered.
 * @param identified - providers identified for takeover.
 * @returns the section to write, or the previous value when no change.
 */
export function nextTakeoverSection(
  previous: TakeoverSection | undefined,
  identified: readonly string[],
): TakeoverSection {
  const base: TakeoverSection = previous ?? { enabled: false, providers: [] }
  if (identified.length === 0) {
    // Nothing to take over: keep the previous list untouched (respect a manual
    // list; do not enable on our own).
    return base
  }
  const merged = [...base.providers]
  for (const id of identified) {
    if (!merged.includes(id)) merged.push(id)
  }
  if (base.enabled && merged.length === base.providers.length) return base
  return { enabled: true, providers: merged }
}
