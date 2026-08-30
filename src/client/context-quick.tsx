/**
 * Context-window quick control for the composer tool row
 * (`conversation.input.right`, the seat just left of the send button and next
 * to the model/effort select).
 *
 * It targets the CURRENT session's active model (read from the trajectory
 * view's latest assistant request) and lets the user cap that model's context
 * window on the fly — presets, a custom integer, or clear to restore.
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
 * Kept dependency-free beyond react + the injected scopes: the trigger is a
 * plain pill, the popover renders inline (absolutely positioned above the tool
 * row), and validation reuses the shared `validateContextWindow`.
 */
import { useState, useSyncExternalStore } from 'react'
import type { CSSProperties, JSX } from 'react'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import { CONTEXT_WINDOW_PRESETS, formatContextWindow, validateContextWindow } from '../context-window.ts'

/** The official DeepSeek provider route owned by the llm-deepseek adapter. */
const DEEPSEEK_PROVIDER = 'deepseek-official'
/** llm-deepseek's native default context capacity (DEFAULT_CONTEXT_WINDOW). */
const DEEPSEEK_DEFAULT_WINDOW = 1_000_000

/** One injected face: the `llm-pi-ai` and `llm-deepseek` namespace scopes. */
export interface ContextQuickInjected {
  /** The `llm-pi-ai` settings namespace (custom gateway models). */
  piAiScope: SettingsScope<unknown>
  /** The `llm-deepseek` settings namespace (official DeepSeek models). */
  deepseekScope: SettingsScope<unknown>
}

/** Full props: injected scopes + the session standard seats + locale copy. */
export interface ContextQuickProps extends ContextQuickInjected {
  /** The session id of the slot's owning conversation (standard seat). */
  sessionId: string
  /** Session snapshot hook (standard seat): returns the ConversationSnapshot. */
  useSession: () => unknown
  /** Locale copy thunk. */
  t: (key: string) => string
}

/* ── shared inline styling (no CSS modules in the client bundle) ───────── */

const pillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  height: '24px',
  padding: '0 8px',
  background: 'var(--dsw-alias-bg-surface, #fff)',
  color: 'var(--dsw-alias-label-secondary)',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: '6px',
  fontSize: '11px',
  lineHeight: '16px',
  fontFamily: 'var(--ds-font-family-code, monospace)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const popStyle: CSSProperties = {
  position: 'absolute',
  bottom: 'calc(100% + 8px)',
  right: '0',
  zIndex: 1200,
  minWidth: '240px',
  padding: '10px',
  background: 'var(--dsw-alias-bg-layer-3, rgba(127,127,127,0.05))',
  color: 'var(--dsw-alias-label-primary)',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: '10px',
  boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
}

const backdropStyle: CSSProperties = { position: 'fixed', inset: 0, zIndex: 1199 }

const labelStyle: CSSProperties = { margin: 0, fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-secondary)' }

const hintStyle: CSSProperties = { margin: 0, fontSize: '11px', lineHeight: '16px', color: 'var(--dsw-alias-label-tertiary)' }

const presetRowStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '5px' }

const presetStyle: CSSProperties = {
  height: '22px',
  padding: '0 8px',
  background: 'var(--dsw-alias-bg-surface, #fff)',
  color: 'var(--dsw-alias-label-secondary)',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: '5px',
  fontSize: '11px',
  lineHeight: '16px',
  fontFamily: 'var(--ds-font-family-code, monospace)',
  cursor: 'pointer',
}

const inputStyle: CSSProperties = {
  flex: '1 1 auto',
  minWidth: '0',
  background: 'var(--dsw-alias-bg-surface, #fff)',
  color: 'var(--dsw-alias-label-primary)',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: '5px',
  padding: '3px 8px',
  fontSize: '12px',
  fontFamily: 'var(--ds-font-family-code, monospace)',
  boxSizing: 'border-box',
}

const actionStyle: CSSProperties = {
  height: '24px',
  padding: '0 10px',
  background: 'var(--dsw-alias-bg-surface, #fff)',
  color: 'var(--dsw-alias-label-primary)',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: '5px',
  fontSize: '12px',
  lineHeight: '18px',
  cursor: 'pointer',
}

const errorStyle: CSSProperties = { margin: 0, fontSize: '11px', lineHeight: '16px', color: 'var(--dsw-alias-danger, #e5484d)' }

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

/** The narrow trajectory-view slice the component reads for provider/model. */
interface TrajectoryLike {
  requests?: readonly {
    purpose?: string
    prompt?: { config?: { provider?: string; model?: string } }
  }[]
}

/**
 * The current session's active model, reconstructed from the trajectory view's
 * latest assistant request prompt config. Absent for a blank session (no
 * request yet) — the control then renders read-only/disabled.
 */
function activeModelOf(session: unknown): { provider: string; model: string } | undefined {
  if (typeof session !== 'object' || session === null) return undefined
  const views = (session as { views?: { get?: (key: string) => unknown } }).views
  const trajectory = views?.get?.('trajectory') as TrajectoryLike | undefined
  const requests = trajectory?.requests ?? []
  for (let index = requests.length - 1; index >= 0; index -= 1) {
    const config = requests[index]?.prompt?.config
    if (requests[index]?.purpose === 'assistant'
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
 * The composer context-window quick control: a pill showing the current
 * session model's context window that opens an inline popover with preset
 * quick-picks, a custom integer input and a clear (restore default) action.
 * Custom gateways and official DeepSeek models are both supported (see module
 * doc for the namespace each writes).
 * @param props - injected scopes, session standard seats, copy.
 */
export function ContextQuick({ useSession, piAiScope, deepseekScope, t }: ContextQuickProps): JSX.Element {
  const session = useSession()
  const active = activeModelOf(session)
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

  // UI-only state: the popover, the custom draft and its error.
  const [open, setOpen] = useState(false)
  const [raw, setRaw] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const disabled = readonly || busy || active === undefined || !writableTarget

  /** Commit (or delete) the active model's context window. */
  const commitWindow = (value: number | undefined): void => {
    if (active === undefined || snapshot.status !== 'ready' || !writableTarget) return
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
      commit.then(() => { setBusy(false) }).catch(() => { setBusy(false) })
      return
    }
    const next = structuredClone(providers)
    const profile = next[active.provider] as { models?: unknown[] } | undefined
    const entry = profile?.models?.find(candidate =>
      typeof candidate === 'object' && candidate !== null && (candidate as Record<string, unknown>)['id'] === active.model)
    if (entry === undefined) {
      setBusy(false)
      return
    }
    if (value === undefined) delete (entry as Record<string, unknown>)['contextWindow']
    else (entry as Record<string, unknown>)['contextWindow'] = value
    void piAiScope.set('providers', next)
      .then(() => { setBusy(false) })
      .catch(() => { setBusy(false) })
  }

  /** Pick one preset immediately. */
  const pickPreset = (value: number): void => {
    setRaw(String(value))
    setError(null)
    commitWindow(value)
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

  const triggerLabel = currentWindow === undefined
    ? t('input.context.unset')
    : formatContextWindow(currentWindow)

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        disabled={disabled}
        style={{
          ...pillStyle,
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.55 : 1,
        }}
        title={active === undefined
          ? t('input.context.noModel')
          : `${active.provider}/${active.model}`}
        onClick={() => { setOpen(current => !current) }}
      >
        {triggerLabel}
      </button>
      {open
        ? (
          <>
            <div style={backdropStyle} onClick={() => setOpen(false)} />
            <div style={popStyle} role="dialog" aria-label={t('input.context.title')}>
              <p style={labelStyle}>
                {t('input.context.title')}
                {active !== undefined ? ` · ${active.provider}/${active.model}` : ''}
              </p>
              <p style={hintStyle}>{t('input.context.globalHint')}</p>
              <div style={presetRowStyle}>
                {CONTEXT_WINDOW_PRESETS.map(preset => (
                  <button
                    key={preset.value}
                    type="button"
                    disabled={disabled}
                    style={{
                      ...presetStyle,
                      cursor: disabled ? 'default' : 'pointer',
                      opacity: disabled ? 0.5 : 1,
                    }}
                    onClick={() => pickPreset(preset.value)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={raw}
                  disabled={disabled}
                  placeholder={t('input.context.customPlaceholder')}
                  style={inputStyle}
                  onChange={(event) => { setRaw(event.currentTarget.value) }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') { setOpen(false); applyCustom() }
                  }}
                />
                <button
                  type="button"
                  disabled={disabled}
                  style={{ ...actionStyle, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1 }}
                  onClick={() => { setOpen(false); applyCustom() }}
                >
                  {t('input.context.apply')}
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  style={{ ...actionStyle, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1 }}
                  onClick={() => { setOpen(false); setRaw(''); setError(null); commitWindow(undefined) }}
                >
                  {t('input.context.clear')}
                </button>
              </div>
              {error !== null && <p style={errorStyle}>{error}</p>}
            </div>
          </>
        )
        : null}
    </div>
  )
}

export default ContextQuick
