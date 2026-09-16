/**
 * Session tool-call sampling for dsh-thinking-levels.
 *
 * Pulled out of the plugin body so the extraction logic — the part most
 * exposed to dsh event-shape drift — is unit-testable in isolation, with
 * explicit guards instead of naked type assertions. If a future dsh version
 * reshapes `session.events`, the failure shows up in the tests, not as a
 * silently wrong effort decision.
 */
import type { ToolCallSample } from './thinking-level.ts';
/** How many recent tool calls to sample for one decision. */
export declare const TOOL_SAMPLE_WINDOW = 8;
/**
 * Recent tool calls of a session's current step, oldest first.
 * Non-tool events and malformed records are skipped; at most
 * {@link TOOL_SAMPLE_WINDOW} samples are returned.
 *
 * @param agent - the `payload.agent` value from the `agent/request` waterfall.
 * @returns the sampled tool calls, or `[]` for a fresh prompt / unknown shape.
 */
export declare function recentToolCalls(agent: unknown): ToolCallSample[];
