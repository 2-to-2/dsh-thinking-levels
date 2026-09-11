/**
 * Context-window quick control for the model menu card
 * (`conversation.input.model.section`, rendered under the Model /
 * Reasoning-effort rows of the root pane).
 *
 * It targets the CURRENT session's active model (read through the session
 * `useTrajectory` standard seat) and lets the user cap that model's context
 * window on the fly. The row is deliberately compact: one label, a slider over
 * the shared presets, the committed value, a collapsed custom-integer editor
 * and Clear — no title block and no preset button grid.
 *
 * Two model families are served, each with its own writable settings
 * namespace (both consumed live by `resolveModelInfo(...).context.contextWindow`,
 * so a write takes effect on the next request without a restart):
 * - Custom gateways (`llm-pi-ai` providers): writes the model entry's
 *   `contextWindow` under `providers[provider].models[i]`.
 * - Official DeepSeek models (`deepseek-official`, the `llm-deepseek`
 *   namespace): writes the catalog model's `contextWindow` when the model is
 *   listed, otherwise caps via `defaultContextWindow`.
 *
 * Write discipline: dragging the slider only moves a local draft; the settings
 * write happens once per gesture (pointer release, key release, blur), so a
 * drag never floods the host with intermediate values.
 *
 * Kept dependency-free beyond react + the injected scopes: plain HTML controls
 * with token-based inline styling, and validation reuses the shared
 * `validateContextWindow`.
 */
import { useState, useSyncExternalStore } from 'react'
import type { CSSProperties, JSX } from 'react'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import { CONTEXT_WINDOW_PRESETS, formatContextWindow, validateContextWindow } from '../context-window.ts'

/** The official DeepSeek provider route owned by the llm-deepseek adapter. */
const DEEPSEEK_PROVIDER = 'deepseek-official'
/** llm-deepseek's native default context capacity (DEFAULT_CONTEXT_WINDOW). */
const DEEPSEEK_DEFAULT_WINDOW = 1_000_000
/** Slider stop an unset window parks on: the thumb needs a position, the readout stays "unset". */
const UNSET_STOP_INDEX = CONTEXT_WINDOW_PRESETS.findIndex(preset => preset.value === 256_000)

/** One injected face: the `llm-pi-ai` and `llm-deepseek` namespace scopes. */
export interface ContextQuickInjected {
  /** The `llm-pi-ai` settings namespace (custom gateway models). */
  piAiScope: SettingsScope<unknown>
  /** The `llm-deepseek` settings namespace (official DeepSeek models). */
  deepseekScope: SettingsScope<unknown>
}

/** The narrow trajectory-view slice the component reads for provider/model. */
interface TrajectoryLike {
  requests?: readonly {
    purpose?: string
    prompt?: { config?: { provider?: string; model?: string } }
  }[]
}

/**
 * One renderer standard seat: a `useSyncExternalStoreWithSelector`-bound
 * selector hook over a host observable. The selector is required — the kit
 * never defaults it (compare `useProjection`, which does).
 */
type SnapshotSelectorHook<Snapshot> = <Selected>(
  selector: (snapshot: Snapshot) => Selected,
  isEqual?: (a: Selected, b: Selected) => boolean,
) => Selected

/** Full props: injected scopes + the session standard seats + locale copy. */
export interface ContextQuickProps extends ContextQuickInjected {
  /** The session id of the slot's owning conversation (standard seat). */
  sessionId: string
  /**
   * The session `useTrajectory` standard seat: a selector hook over the current
   * conversation binding's Trajectory view (the ledger that carries every
   * assembled request). It is NOT a bare snapshot getter — a selector is
   * mandatory.
   */
  useTrajectory: SnapshotSelectorHook<TrajectoryLike>
  /** Locale copy thunk. */
  t: (key: string) => string
}

/* ── shared inline styling (no CSS modules in the client bundle) ───────── */

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  // The seat renders the contribution bare inside the menu card, so the row
  // carries its own divider and spacing below the effort row.
  marginTop: '4px',
  paddingTop: '7px',
  borderTop: '1px solid var(--dsw-alias-border-l1)',
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '12px',
  lineHeight: '18px',
  color: 'var(--dsw-alias-label-secondary)',
}

const labelStyle: CSSProperties = {
  flex: '0 0 auto',
  minWidth: '0',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: 'var(--dsw-alias-label-tertiary)',
}

const sliderStyle: CSSProperties = {
  flex: '1 1 auto',
  minWidth: '56px',
  height: '14px',
  margin: '0',
  accentColor: 'var(--dsw-alias-state-business-primary)',
  cursor: 'pointer',
}

const valueStyle: CSSProperties = {
  flex: '0 0 auto',
  minWidth: '40px',
  textAlign: 'right',
  color: 'var(--dsw-alias-label-primary)',
  fontFamily: 'var(--ds-font-family-code, monospace)',
  fontVariantNumeric: 'tabular-nums',
}

const glyphButtonStyle: CSSProperties = {
  flex: '0 0 auto',
  height: '18px',
  padding: '0 5px',
  border: '1px solid transparent',
  borderRadius: '4px',
  background: 'transparent',
  color: 'var(--dsw-alias-label-tertiary)',
  font: 'inherit',
  cursor: 'pointer',
}

const actionButtonStyle: CSSProperties = {
  flex: '0 0 auto',
  height: '18px',
  padding: '0 6px',
  border: '1px solid transparent',
  borderRadius: '4px',
  background: 'transparent',
  color: 'var(--dsw-alias-label-secondary)',
  font: 'inherit',
  cursor: 'pointer',
}

const customRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
}

const inputStyle: CSSProperties = {
  flex: '1 1 auto',
  minWidth: '0',
  boxSizing: 'border-box',
  padding: '2px 6px',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: '5px',
  background: 'var(--dsw-alias-bg-surface, #fff)',
  color: 'var(--dsw-alias-label-primary)',
  font: 'inherit',
}

const errorStyle: CSSProperties = {
  flex: '0 0 auto',
  color: 'var(--dsw-alias-danger, #e5484d)',
}

/* ── helpers over the settings user layer ──────────────────────────────── */

/** The user-layer `providers` value of the llm-pi-ai namespace, when present. */
function providersOf(snapshot: unknown): Record<string, unknown> {
  if (typeof snapshot !== 'object' || snapshot === null) return {}
  const user = (snapshot as { user?: unknown }).user
  if (typeof user !== 'object' || user === null || Array.isArray(user)) return {}
  const providers = (user as Record<string, unknown>)['providers']
  return typeof providers === 'object' && providers !== null && !Array.isArray(providers)
    ? providers as Record<string, unknown>
    : {}
}

/** The user-layer `models`/`defaultContextWindow` of the llm-deepseek namespace. */
function deepseekSectionOf(snapshot: unknown): {
  models?: Record<string, unknown>[]
  defaultContextWindow?: number
} {
  if (typeof snapshot !== 'object' || snapshot === null) return {}
  const user = (snapshot as { user?: unknown }).user
  if (typeof user !== 'object' || user === null || Array.isArray(user)) return {}
  const section = user as { models?: unknown; defaultContextWindow?: unknown }
  const models = Array.isArray(section.models)
    ? section.models.filter((model): model is Record<string, unknown> =>
      typeof model === 'object' && model !== null && !Array.isArray(model))
    : undefined
  const defaultContextWindow = typeof section.defaultContextWindow === 'number'
    ? section.defaultContextWindow
    : undefined
  return {
    ...models === undefined ? {} : { models },
    ...defaultContextWindow === undefined ? {} : { defaultContextWindow },
  }
}

/**
 * The stable trajectory selector: the seat memoizes its selection on the
 * selector reference, so it must not be a fresh closure per render. Selecting
 * the request ledger (a snapshot-owned array, not a derived object) keeps the
 * selected value reference-stable between snapshots — a selector that built a
 * new object would re-render forever.
 * @param snapshot - the current Trajectory view snapshot.
 * @returns the assembled request ledger.
 */
const selectRequests = (snapshot: TrajectoryLike): TrajectoryLike['requests'] => snapshot.requests

/**
 * The current session's active model, taken from the trajectory ledger's
 * latest assistant request prompt config. Absent for a blank session (no
 * request yet) — the control then renders read-only/disabled.
 * @param requests - the trajectory ledger's request views.
 */
function activeModelOf(requests: TrajectoryLike['requests']): { provider: string; model: string } | undefined {
  const list = requests ?? []
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const config = list[index]?.prompt?.config
    if (list[index]?.purpose === 'assistant'
      && typeof config?.provider === 'string'
      && typeof config?.model === 'string') {
      return { provider: config.provider, model: config.model }
    }
  }
  return undefined
}

/** One model entry's declared contextWindow, when present. */
function contextWindowOf(model: Record<string, unknown>): number | undefined {
  const value = model['contextWindow']
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

/**
 * The slider stop nearest to a committed token count; a window that matches no
 * preset (typed through the card) still parks the thumb on its closest stop.
 * @param value - the committed context window, when one is set.
 * @returns the stop index, or the unset park position.
 */
function stopIndexOf(value: number | undefined): number {
  if (value === undefined) return UNSET_STOP_INDEX
  let best = 0
  let bestDistance = Number.POSITIVE_INFINITY
  CONTEXT_WINDOW_PRESETS.forEach((preset, index) => {
    const distance = Math.abs(preset.value - value)
    if (distance < bestDistance) {
      bestDistance = distance
      best = index
    }
  })
  return best
}

/**
 * The model card's context-window section: a preset slider, the committed
 * value, a collapsed custom-integer editor and Clear. Custom gateways and
 * official DeepSeek models are both supported (see module doc for the
 * namespace each writes).
 * @param props - injected scopes, session standard seats, copy.
 */
export function ContextQuick({ useTrajectory, piAiScope, deepseekScope, t }: ContextQuickProps): JSX.Element {
  const active = activeModelOf(useTrajectory(selectRequests))
  const official = active !== undefined && active.provider === DEEPSEEK_PROVIDER

  const piSnapshot = useSyncExternalStore(
    (listener) => piAiScope.subscribe(listener),
    () => piAiScope.getSnapshot(),
  )
  const dsSnapshot = useSyncExternalStore(
    (listener) => deepseekScope.subscribe(listener),
    () => deepseekScope.getSnapshot(),
  )
  const snapshot = official ? dsSnapshot : piSnapshot
  const unavailable = snapshot.status === 'unavailable'
  const readonly = unavailable || !snapshot.writable
  const providers = official ? {} : providersOf(piSnapshot)
  const dsSection = official ? deepseekSectionOf(dsSnapshot) : undefined

  // Resolve the effective window and whether a write target exists.
  let currentWindow: number | undefined
  let writableTarget = false
  if (official && active !== undefined) {
    const models = dsSection?.models ?? []
    const index = models.findIndex(model => model['id'] === active.model)
    currentWindow = index >= 0 ? contextWindowOf(models[index]) : undefined
    if (currentWindow === undefined) currentWindow = dsSection?.defaultContextWindow
    writableTarget = true
  } else if (active !== undefined) {
    const profile = providers[active.provider] as { models?: unknown[] } | undefined
    const model = profile !== undefined && Array.isArray(profile.models)
      ? profile.models.find((candidate): candidate is Record<string, unknown> =>
        typeof candidate === 'object' && candidate !== null && (candidate as Record<string, unknown>)['id'] === active.model)
      : undefined
    currentWindow = model === undefined ? undefined : contextWindowOf(model)
    writableTarget = model !== undefined
  }

  // UI-only state: the uncommitted stop, the custom draft and its error.
  const [draft, setDraft] = useState<number | null>(null)
  const [custom, setCustom] = useState(false)
  const [raw, setRaw] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const disabled = readonly || busy || active === undefined || !writableTarget
  const stop = draft ?? stopIndexOf(currentWindow)

  /** Commit (or delete) the active model's context window. */
  const commitWindow = (value: number | undefined): void => {
    if (active === undefined || snapshot.status !== 'ready' || !writableTarget) {
      setDraft(null)
      return
    }
    setBusy(true)
    if (official) {
      // Official DeepSeek: cap the catalog model when listed, else the provider default.
      const models = (deepseekSectionOf(dsSnapshot).models ?? []).map(model => ({ ...model }))
      const index = models.findIndex(model => model['id'] === active.model)
      const commit = index >= 0
        ? deepseekScope.set('models', models.map((model, at) => {
          if (at !== index) return model
          if (value === undefined) {
            const rest = { ...model }
            delete rest['contextWindow']
            return rest
          }
          return { ...model, contextWindow: value }
        }))
        : deepseekScope.set('defaultContextWindow', value === undefined ? DEEPSEEK_DEFAULT_WINDOW : value)
      commit.then(() => { setBusy(false); setDraft(null) }).catch(() => { setBusy(false); setDraft(null) })
      return
    }
    const next = structuredClone(providers)
    const profile = next[active.provider] as { models?: unknown[] } | undefined
    const entry = profile?.models?.find(candidate =>
      typeof candidate === 'object' && candidate !== null && (candidate as Record<string, unknown>)['id'] === active.model)
    if (entry === undefined) {
      setBusy(false)
      setDraft(null)
      return
    }
    if (value === undefined) delete (entry as Record<string, unknown>)['contextWindow']
    else (entry as Record<string, unknown>)['contextWindow'] = value
    void piAiScope.set('providers', next)
      .then(() => { setBusy(false); setDraft(null) })
      .catch(() => { setBusy(false); setDraft(null) })
  }

  /** Write the stop the gesture landed on; a drag only moves the draft. */
  const commitStop = (): void => {
    if (disabled || draft === null) return
    commitWindow(CONTEXT_WINDOW_PRESETS[draft]?.value)
  }

  /** Validate and commit the custom input; empty clears. */
  const applyCustom = (): void => {
    const trimmed = raw.trim()
    if (trimmed === '') {
      setError(null)
      commitWindow(undefined)
      return
    }
    const validation = validateContextWindow(trimmed)
    if (!validation.ok) {
      setError(t(validation.reason === 'integer' ? 'input.context.integer' : 'input.context.range'))
      return
    }
    setError(null)
    commitWindow(validation.value)
  }

  const value = draft === null
    ? currentWindow === undefined ? t('input.context.unset') : formatContextWindow(currentWindow)
    : formatContextWindow(CONTEXT_WINDOW_PRESETS[draft]?.value ?? 0)

  return (
    <section style={sectionStyle} role="group" aria-label={t('input.context.title')}>
      <div style={rowStyle}>
        <span style={labelStyle} title={t('input.context.globalHint')}>{t('input.context.title')}</span>
        <input
          type="range"
          min={0}
          max={CONTEXT_WINDOW_PRESETS.length - 1}
          step={1}
          value={stop}
          disabled={disabled}
          aria-label={t('input.context.title')}
          title={active === undefined ? t('input.context.noModel') : `${active.provider}/${active.model}`}
          style={{ ...sliderStyle, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1 }}
          onChange={(event) => { setDraft(Number(event.currentTarget.value)) }}
          onPointerUp={commitStop}
          onKeyUp={commitStop}
          onBlur={commitStop}
        />
        <span style={valueStyle}>{value}</span>
        <button
          type="button"
          disabled={disabled}
          aria-label={t('input.context.custom')}
          aria-expanded={custom}
          title={t('input.context.custom')}
          style={{ ...glyphButtonStyle, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1 }}
          onClick={() => { setCustom(open => !open); setError(null) }}
        >
          ⋯
        </button>
        <button
          type="button"
          disabled={disabled || currentWindow === undefined}
          style={{
            ...actionButtonStyle,
            cursor: disabled || currentWindow === undefined ? 'default' : 'pointer',
            opacity: disabled || currentWindow === undefined ? 0.55 : 1,
          }}
          onClick={() => { setDraft(null); setError(null); setRaw(''); commitWindow(undefined) }}
        >
          {t('input.context.clear')}
        </button>
      </div>
      {custom
        ? (
          <div style={customRowStyle}>
            <input
              type="text"
              inputMode="numeric"
              value={raw}
              disabled={disabled}
              placeholder={t('input.context.customPlaceholder')}
              aria-label={t('input.context.customPlaceholder')}
              style={inputStyle}
              onChange={(event) => { setRaw(event.currentTarget.value) }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applyCustom()
              }}
            />
            <button
              type="button"
              disabled={disabled}
              style={{ ...actionButtonStyle, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1 }}
              onClick={applyCustom}
            >
              {t('input.context.apply')}
            </button>
            {error !== null && <span style={errorStyle}>{error}</span>}
          </div>
        )
        : null}
    </section>
  )
}

export default ContextQuick
