/**
 * Pure context-window helpers for the dsh-thinking-levels plugin.
 *
 * The context-window limit of a custom gateway model is declared in the
 * llm-pi-ai model entry (`contextWindow`, a positive integer). The harness
 * consumes it through `resolveModelInfo(...).context.contextWindow` for
 * compaction thresholds, context-overflow detection and context-pressure
 * projections — a settings write takes effect on the next request without a
 * restart. This module centralizes the legal range, the common presets and
 * the display formatting shared by the config schema, the settings card and
 * the tests. Kept dependency-free (pure inputs -> output).
 */
/** Smallest accepted context window (tokens), aligned with dsh-thinking-effort. */
export declare const CONTEXT_WINDOW_MIN = 2000;
/** Largest accepted context window (tokens), e.g. third-party DeepSeek 1M. */
export declare const CONTEXT_WINDOW_MAX = 1000000;
/** One selectable context-window preset. */
export interface ContextWindowPreset {
    /** Human-readable label shown on the card button and the model badge. */
    label: string;
    /** The token count written to the llm-pi-ai model entry. */
    value: number;
}
/** The multi-level context-window presets, in ascending order. */
export declare const CONTEXT_WINDOW_PRESETS: readonly ContextWindowPreset[];
/** Format a token count as a readable label (exact presets keep their label). */
export declare function formatContextWindow(value: number): string;
/** The result of validating a context-window value. */
export type ContextWindowValidation = {
    ok: true;
    value: number;
} | {
    ok: false;
    reason: 'integer' | 'range';
};
/**
 * Validate a context-window candidate (number or numeric string). Accepts only
 * base-10 integers inside [CONTEXT_WINDOW_MIN, CONTEXT_WINDOW_MAX]; anything
 * else (float, 'abc', '1e3', out-of-range) is rejected with a reason.
 */
export declare function validateContextWindow(value: unknown): ContextWindowValidation;
