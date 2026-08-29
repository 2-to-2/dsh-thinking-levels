/**
 * Pure thinking-level decision for the dsh-thinking-levels plugin.
 *
 * The measured bottleneck of tool calls in dsh is the model's THINKING phase
 * (~90% of the wall-clock time for simple tasks), not the tool execution
 * itself. DeepSeek's API exposes `reasoning_effort` in wire levels
 * (off / low / high / max; low shipped 2026-08-13 in dsh rc.7 — rc.6 and
 * older adapters only accept off / high / max).
 *
 * The plugin offers FIVE user-facing levels:
 * - `off`  : thinking disabled (manual only — never auto-picked).
 * - `low`  : cheap rounds stay cheap. Native since dsh rc.7; the manual pick
 *            passes through unchanged (never rewritten), and the auto
 *            scheduler may pick it for models that support it.
 * - `high` : manual fix, the official default effort.
 * - `max`  : manual fix for heavy work.
 * - `auto` : schedule per step from the recent tool-call history, between
 *            `low` / `high` / `max` (never `off`, never `auto` itself).
 *
 * A request-level guard decides whether an effort may be injected at all:
 * models that do not advertise reasoning metadata (custom openai-completions
 * routes such as Qwen3.6 with no `reasoningEfforts`) must never receive a
 * `reasoningEffort` — dsh rejects it per request with
 * UNSUPPORTED_REASONING_EFFORT. Unsupported fields are stripped, not sent.
 *
 * Kept dependency-free (pure inputs -> output) so the policy is unit-testable
 * in isolation; the plugin host feeds it the live session's recent calls.
 */

/** The five user-facing thinking levels; the wire levels dsh forwards plus the scheduler sentinel. */
export type EffortId = 'off' | 'low' | 'high' | 'max' | 'auto'

/** Wire levels the auto scheduler may pick (never `off`, never `auto`). */
export type AutoEffort = Exclude<EffortId, 'auto' | 'off'>

/** Runtime guard: is this a level the plugin understands? */
export function isEffortId(value: unknown): value is EffortId {
  return value === 'off' || value === 'low' || value === 'high' || value === 'max' || value === 'auto'
}

/**
 * Fail-loud config validation: reject an out-of-band level (e.g. a stray
 * `medium` from an old profile) instead of silently injecting it into the
 * model request, where dsh would throw `UNSUPPORTED_REASONING_EFFORT`.
 */
export function assertEffortId(value: unknown, where: string): asserts value is EffortId {
  if (!isEffortId(value)) {
    throw new TypeError(`${where}: invalid thinking level ${JSON.stringify(value)} (expected off | low | high | max | auto)`)
  }
}

/** One observed tool call of the current/last step. */
export interface ToolCallSample {
  /** Tool name, e.g. 'bash', 'fs_write', 'web_search', 'mcp__...'. */
  name: string
  /** Approximate argument size in characters (payload heft). */
  argsSize: number
}

/**
 * Everything the policy needs to decide one request's level.
 */
export interface EffortDecisionInput {
  /** Recent tool calls of the step (oldest first); empty for a fresh prompt. */
  recentCalls: readonly ToolCallSample[]
  /** The user-selected level: a fixed wire level, or `auto` for scheduling. */
  selected: EffortId
  /** Scheduler preference: allow the scheduler to drop below the hub (`high`). */
  allowDowngrade: boolean
  /** User preference: allow the scheduler to lift above the hub to `max`. */
  allowUpgrade: boolean
}

/** Deterministic tool names that are cheap to reason about (word-boundary anchored). */
const SIMPLE_TOOL_RE = /^(?:fs|bash|terminal|code|text|todo|job|skill|read|list|search|write|grep|glob|edit|ls|cat|rm|mv|cp|touch|mkdir|pwd|head|tail)(?:_|$)/i

/** Hefty payloads signal non-trivial work no matter the tool name. */
const HEAVY_ARGS = 800

/** Count how many of the recent calls look cheap-and-deterministic. */
function simpleRatio(calls: readonly ToolCallSample[]): number {
  if (calls.length === 0) return 1
  const simple = calls.filter(call =>
    SIMPLE_TOOL_RE.test(call.name) && call.argsSize < HEAVY_ARGS,
  ).length
  return simple / calls.length
}

/**
 * Auto schedule: map a recent tool-call history to the wire level the NEXT
 * model request of that step should use.
 *
 * Hub is `high` (the official default). Rules:
 * - No tool calls yet (fresh prompt, pure chat) -> `low` (simple chat tasks).
 * - All/mostly simple tools -> `low` (when downgrades are allowed).
 * - Mixed or heavy tools -> `high` (the hub).
 * - Very heavy context (huge args) -> `max` (when upgrades are allowed).
 *
 * The scheduler MAY pick `low`: the request-level capability guard strips any
 * effort from models that do not support it, so a scheduled `low` only ever
 * reaches models that advertise the level.
 *
 * @param calls - recent tool calls of the step.
 * @param allowDowngrade - may drop below `high`.
 * @param allowUpgrade - may lift above `high`.
 * @returns a wire level; never `off` (off is manual-only) and never `auto`.
 */
function scheduleEffort(
  calls: readonly ToolCallSample[],
  allowDowngrade: boolean,
  allowUpgrade: boolean,
): AutoEffort {
  if (calls.length === 0) return allowDowngrade ? 'low' : 'high'

  const ratio = simpleRatio(calls)
  const heaviest = calls.reduce((max, call) => Math.max(max, call.argsSize), 0)

  if (ratio >= 0.75 && allowDowngrade) return 'low'
  if (heaviest >= HEAVY_ARGS * 4 && allowUpgrade) return 'max'
  return 'high'
}

/**
 * Map the user's selected level to the level injected into the next
 * `agent/request`. Manual levels (off / low / high / max) pass through
 * unchanged — `low` is the manual pick for simple chat tasks. `auto`
 * delegates to the tool-history scheduler.
 *
 * @param input - recent calls, the selected level and the user's toggles.
 * @returns The level to inject; `auto` is resolved before returning.
 */
export function decideEffort(input: EffortDecisionInput): EffortId {
  const { recentCalls, selected, allowDowngrade, allowUpgrade } = input
  if (selected !== 'auto') return selected
  return scheduleEffort(recentCalls, allowDowngrade, allowUpgrade)
}

/**
 * Whether a model's resolved metadata advertises reasoning-effort support.
 * dsh resolves `reasoning` to `undefined` for non-reasoning models (e.g. a
 * hand-declared openai-completions route without `reasoningEfforts`), and
 * rejects any requested effort for them per request. An empty efforts list is
 * equally incapable and is treated as unsupported.
 * @param reasoning - the `reasoning` field of a resolved model info.
 * @returns true when the model advertises at least one effort level.
 */
export function reasoningEffortSupported(reasoning: unknown): boolean {
  if (typeof reasoning !== 'object' || reasoning === null) return false
  const efforts = (reasoning as { efforts?: unknown }).efforts
  return Array.isArray(efforts) && efforts.length > 0
}

/** One request-level injection decision. */
export interface EffortInjectionInput {
  /** Whether the target model advertises reasoning-effort support. */
  supportsReasoning: boolean
  /** The `reasoningEffort` already present on the request seed, if any. */
  seedEffort: unknown
  /** Plugin-configured default level when the seed carries none. */
  selected: EffortId
  /** Recent tool calls of the step, for the auto scheduler. */
  recentCalls: readonly ToolCallSample[]
  /** Scheduler preference: allow the scheduler to drop below `high`. */
  allowDowngrade: boolean
  /** Scheduler preference: allow lifting above `high` to `max`. */
  allowUpgrade: boolean
}

/** The resolved action for one `agent/request`. */
export interface EffortInjectionDecision {
  /** Keep/inject a `reasoningEffort` on the request (false = strip it). */
  inject: boolean
  /** The wire level to set, present when `inject` is true. */
  level?: EffortId
}

/**
 * Decide what one model request should do with `reasoningEffort`.
 *
 * - A model without reasoning support never receives the field: dsh would
 *   throw UNSUPPORTED_REASONING_EFFORT, so the seed's inherited effort (from a
 *   previous route or session header) is stripped.
 * - A manual wire selection (off/low/high/max) passes through unchanged.
 * - `auto` (or no selection) resolves through the scheduler; a scheduled `low`
 *   only reaches models that advertise the level (the capability guard above
 *   already stripped everything from non-supporting models).
 *
 * @param input - model capability plus the seed's current effort.
 * @returns whether to inject and the level to set.
 */
export function resolveEffortInjection(input: EffortInjectionInput): EffortInjectionDecision {
  const { supportsReasoning, seedEffort, selected } = input
  if (!supportsReasoning) return { inject: false }
  if (isEffortId(seedEffort) && seedEffort !== 'auto') {
    return { inject: true, level: seedEffort }
  }
  const level = decideEffort({
    recentCalls: input.recentCalls,
    selected: seedEffort === 'auto' ? 'auto' : selected,
    allowDowngrade: input.allowDowngrade,
    allowUpgrade: input.allowUpgrade,
  })
  return { inject: true, level }
}

/** Wall-clock delta of one tool call, for the timing telemetry. */
export function toolDurationMs(startedAt: number, finishedAt: number): number {
  return Math.max(0, finishedAt - startedAt)
}
