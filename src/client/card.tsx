/**
 * Thinking-levels settings card — the `settings.plugin.item` face of the
 * dsh-thinking-levels plugin.
 *
 * The card binds the `thinking-levels` settings namespace through the
 * `settingsScope` cordis service and renders its fields: the level picker
 * (off / low / high / max / auto) plus the scheduler toggles. Every change
 * commits immediately through the scope (no staged form): the decision is read
 * per model request, so a committed change applies to the next request without
 * a restart.
 *
 * Below the scheduler rows, a "model capabilities" block edits the
 * `llm-pi-ai` namespace directly (read + write through the same settings
 * transport): for every custom provider/model it offers the vision toggle,
 * the thinking posture (inherit / enabled / disabled), the effort-level
 * pickers, and the wire thinking format. This is how custom openai-completions
 * routes (Qwen3.6 / Qwen3.8-27B) get their capability metadata without
 * touching any official package — llm-pi-ai's own schema validates every
 * write.
 *
 * Kept dependency-free beyond react: the scopes are subscribed with
 * `useSyncExternalStore`, and the controls are plain HTML so the client bundle
 * needs no CSS modules and no primitives value import.
 */
import { useState, useSyncExternalStore } from 'react'
import type { CSSProperties, JSX } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { EffortId } from '../thinking-level.ts'
import type { ThinkingLevelsConfig } from '../index.ts'

/** One injected face: the plugin's own scope plus the llm-pi-ai namespace scope. */
export interface ThinkingLevelsCardInjected {
  scope: SettingsScope<ThinkingLevelsConfig>
  /** The `llm-pi-ai` settings namespace, read and written for model capabilities. */
  piAiScope: SettingsScope<unknown>
}

/** Full props: locale seat + the injected scopes. */
export type ThinkingLevelsCardProps = PropsLocale<'thinking-levels'> & ThinkingLevelsCardInjected

/** The five user-facing levels, in picker order. */
const EFFORT_OPTIONS: readonly EffortId[] = ['off', 'low', 'high', 'max', 'auto']

/** The effort levels the capability editor offers, in escalation order. */
const CAPABILITY_LEVELS = ['off', 'low', 'high', 'max'] as const
type CapabilityLevel = typeof CAPABILITY_LEVELS[number]

/** The wire thinking formats offered (llm-pi-ai's nameable set, incl. qwen-chat-template). */
const THINKING_FORMATS = [
  'openai', 'deepseek', 'openrouter', 'together', 'zai', 'qwen',
  'qwen-chat-template', 'string-thinking', 'ant-ling',
] as const

/** Minimal shared row styling (inline; keeps the client bundle CSS-free). */
const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '6px 0',
  fontSize: '13px',
  lineHeight: '20px',
}

const labelStyle: CSSProperties = { margin: 0, color: 'var(--dsw-alias-label-primary)' }

const controlStyle: CSSProperties = {
  background: 'var(--dsw-alias-bg-surface, #fff)',
  color: 'var(--dsw-alias-label-primary)',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: '4px',
  padding: '3px 8px',
  fontSize: '13px',
}

const sectionStyle: CSSProperties = {
  marginTop: '14px',
  paddingTop: '12px',
  borderTop: '1px solid var(--dsw-alias-border-l2)',
}

const modelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  padding: '8px 0',
  borderBottom: '1px solid var(--dsw-alias-border-l2)',
}

const modelHeadStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
}

const modelIdStyle: CSSProperties = {
  margin: 0,
  fontFamily: 'var(--ds-font-family-code, monospace)',
  fontSize: '12px',
  lineHeight: '18px',
  color: 'var(--dsw-alias-label-secondary)',
  overflowWrap: 'anywhere',
}

const checkRowStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }

const fieldStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px' }

const fieldLabelStyle: CSSProperties = { margin: 0, fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' }

const hintStyle: CSSProperties = { margin: '6px 0 0', fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' }

const noteStyle: CSSProperties = { margin: '8px 0 0', fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-state-error-primary)' }

/* Card shell, matching the other settings cards in the plugin tab: an outlined
   row with a disclosure header, collapsed by default like every peer. */
const cardStyle: CSSProperties = {
  border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35))',
  background: 'var(--dsw-alias-bg-layer-3, rgba(127,127,127,0.05))',
  borderRadius: '12px',
  transition: 'border-color 0.16s, background 0.16s',
}

const cardHeaderStyle: CSSProperties = {
  appearance: 'none',
  width: '100%',
  font: 'inherit',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  background: 'none',
  border: 0,
  borderRadius: '12px',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '14px 16px',
}

const cardHeadTextStyle: CSSProperties = { flex: '1 1 0%', minWidth: 0 }

const cardNameStyle: CSSProperties = { fontSize: '14px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }

const cardDescStyle: CSSProperties = { color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))', fontSize: '13px', lineHeight: 1.5 }

const cardChevronStyle: CSSProperties = {
  color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))',
  flex: '0 0 auto',
  transition: 'transform 0.16s',
}

/** One boolean field row (checkbox) bound to the scope. */
function ToggleRow(props: {
  id: string
  label: string
  checked: boolean
  disabled: boolean
  onChange: (next: boolean) => void
}): JSX.Element {
  const { id, label, checked, disabled, onChange } = props
  return (
    <div style={rowStyle}>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    </div>
  )
}

/** A row's `reasoningEfforts` as stored in the user layer. */
function effortsOf(model: Record<string, unknown>): false | Record<string, unknown> | undefined {
  const value = model['reasoningEfforts']
  if (value === false) return false
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return undefined
}

/** The capability levels a row's table declares. */
function effortLevelsOf(model: Record<string, unknown>): CapabilityLevel[] {
  const table = effortsOf(model)
  if (typeof table !== 'object' || table === null) return []
  return CAPABILITY_LEVELS.filter(level => table[level] !== undefined)
}

/** Build a `reasoningEfforts` table from checked levels: `off` → null, others → same-name wire. */
function effortTableOf(levels: readonly CapabilityLevel[]): Record<string, unknown> | undefined {
  if (levels.length === 0) return undefined
  return Object.fromEntries(levels.map(level => [level, level === 'off' ? null : level]))
}

/** The `compat.thinkingFormat` a row declares, or `undefined` when it declares none. */
function formatOf(model: Record<string, unknown>): string | undefined {
  const compat = model['compat']
  if (typeof compat !== 'object' || compat === null || Array.isArray(compat)) return undefined
  const format = (compat as Record<string, unknown>)['thinkingFormat']
  return typeof format === 'string' ? format : undefined
}

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

/**
 * The llm-pi-ai model-capability editor block.
 * @param scope - the `llm-pi-ai` namespace scope.
 * @param t - copy lookup.
 * @param readonly - whether writes are forbidden.
 * @returns the capabilities block, or a placeholder when nothing is configured.
 */
function ModelCapabilities(props: {
  scope: SettingsScope<unknown>
  t: (key: string) => string
  readonly: boolean
}): JSX.Element {
  const { scope, t, readonly } = props
  const snapshot = useSyncExternalStore(
    (listener) => scope.subscribe(listener),
    () => scope.getSnapshot(),
  )
  const unavailable = snapshot.status === 'unavailable'
  const providers = snapshot.status === 'ready' ? providersOf(snapshot) : {}
  const entries = Object.entries(providers).flatMap(([providerId, profile]) => {
    const models = (profile as Record<string, unknown>)['models']
    if (!Array.isArray(models)) return []
    return models.map((model, index) => ({
      providerId,
      index,
      model: (typeof model === 'object' && model !== null && !Array.isArray(model)
        ? model as Record<string, unknown>
        : {}),
    }))
  })

  /** Commit one patch over the user-layer providers. */
  const commitProviders = (mutate: (current: Record<string, unknown>) => Record<string, unknown>): void => {
    if (snapshot.status !== 'ready') return
    const current = structuredClone(providers)
    void scope.set('providers', mutate(current)).catch(() => {})
  }

  /** Patch one model row of one provider. */
  const patchModel = (
    providerId: string,
    index: number,
    patch: (model: Record<string, unknown>) => void,
  ): void => {
    commitProviders((current) => {
      const profile = current[providerId] as { models?: unknown[] } | undefined
      if (profile === undefined || !Array.isArray(profile.models)) return current
      const model = profile.models[index]
      if (typeof model !== 'object' || model === null) return current
      patch(model as Record<string, unknown>)
      return current
    })
  }

  if (unavailable) {
    return (
      <div style={sectionStyle}>
        <p style={hintStyle}>{t('card.capabilities.unavailable')}</p>
      </div>
    )
  }
  if (entries.length === 0) {
    return (
      <div style={sectionStyle}>
        <p style={fieldLabelStyle}>{t('card.capabilities')}</p>
        <p style={hintStyle}>{t('card.capabilities.empty')}</p>
      </div>
    )
  }

  return (
    <div style={sectionStyle}>
      <p style={fieldLabelStyle}>{t('card.capabilities')}</p>
      <p style={hintStyle}>{t('card.capabilities.hint')}</p>
      {entries.map(({ providerId, index, model }) => {
        const efforts = effortsOf(model)
        const thinking = efforts === false ? 'off' : typeof efforts === 'object' ? 'on' : 'inherit'
        const input = model['input']
        const vision = Array.isArray(input) && input.includes('image')
        const format = formatOf(model)
        return (
          <div key={`${providerId}/${index}`} style={modelStyle}>
            <div style={modelHeadStyle}>
              <p style={modelIdStyle}>{providerId} / {typeof model['id'] === 'string' ? model['id'] : `#${index + 1}`}</p>
              <label style={checkRowStyle}>
                <input
                  type="checkbox"
                  checked={vision}
                  disabled={readonly}
                  onChange={(event) => {
                    patchModel(providerId, index, (row) => {
                      // Image input implies text input; the pair is written together.
                      row['input'] = event.currentTarget.checked ? ['text', 'image'] : ['text']
                    })
                  }}
                />
                <span>{t('card.capabilities.vision')}</span>
              </label>
            </div>
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>{t('card.capabilities.thinking')}</span>
              <select
                style={controlStyle}
                value={thinking}
                disabled={readonly}
                onChange={(event) => {
                  const state = event.currentTarget.value as 'inherit' | 'on' | 'off'
                  patchModel(providerId, index, (row) => {
                    if (state === 'inherit') {
                      delete row['reasoningEfforts']
                    } else if (state === 'off') {
                      row['reasoningEfforts'] = false
                    } else {
                      // Keep already-declared levels; without one, a sane
                      // default table (off + high) appears so the row is valid.
                      row['reasoningEfforts'] = effortTableOf(effortLevelsOf(row)) ?? { off: null, high: 'high' }
                    }
                  })
                }}
              >
                <option value="inherit">{t('card.capabilities.thinking.inherit')}</option>
                <option value="on">{t('card.capabilities.thinking.on')}</option>
                <option value="off">{t('card.capabilities.thinking.off')}</option>
              </select>
            </label>
            {thinking === 'on'
              ? (
                <div style={fieldStyle}>
                  <span style={fieldLabelStyle}>{t('card.capabilities.efforts')}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                    {CAPABILITY_LEVELS.map(level => (
                      <label key={level} style={checkRowStyle}>
                        <input
                          type="checkbox"
                          checked={effortLevelsOf(model).includes(level)}
                          disabled={readonly}
                          onChange={(event) => {
                            patchModel(providerId, index, (row) => {
                              const current = effortLevelsOf(row)
                              const next = event.currentTarget.checked
                                ? [...current, level]
                                : current.filter(at => at !== level)
                              // An empty table is not a valid pi-ai declaration,
                              // so dropping the last level removes the field.
                              const table = effortTableOf(next)
                              if (table === undefined) delete row['reasoningEfforts']
                              else row['reasoningEfforts'] = table
                            })
                          }}
                        />
                        <span>{level.charAt(0).toUpperCase() + level.slice(1)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )
              : null}
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>{t('card.capabilities.thinkingFormat')}</span>
              <select
                style={controlStyle}
                value={format ?? 'inherit'}
                disabled={readonly}
                onChange={(event) => {
                  const next = event.currentTarget.value
                  patchModel(providerId, index, (row) => {
                    const compat = typeof row['compat'] === 'object' && row['compat'] !== null && !Array.isArray(row['compat'])
                      ? { ...(row['compat'] as Record<string, unknown>) }
                      : {}
                    if (next === 'inherit') {
                      delete compat['thinkingFormat']
                      if (Object.keys(compat).length === 0) delete row['compat']
                      else row['compat'] = compat
                    } else {
                      compat['thinkingFormat'] = next
                      row['compat'] = compat
                    }
                  })
                }}
              >
                <option value="inherit">{t('card.capabilities.thinkingFormat.inherit')}</option>
                {THINKING_FORMATS.map(formatOption => (
                  <option key={formatOption} value={formatOption}>{formatOption}</option>
                ))}
              </select>
            </label>
          </div>
        )
      })}
      {readonly ? <p style={hintStyle}>{t('card.readonly')}</p> : null}
    </div>
  )
}

/**
 * The card body, wrapped in a disclosure shell like every peer settings card:
 * a header (name + description + chevron) that toggles the body, collapsed by
 * default so the plugin tab stays a tidy list of drawers.
 * @param props - locale copy and the injected scopes.
 */
export function ThinkingLevelsCard({ t, scope, piAiScope }: ThinkingLevelsCardProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const snapshot = useSyncExternalStore(
    (listener) => scope.subscribe(listener),
    () => scope.getSnapshot(),
  )
  const unavailable = snapshot.status === 'unavailable'
  const readonly = unavailable || !snapshot.writable
  const value = (snapshot.value ?? {}) as Partial<ThinkingLevelsConfig>
  const level = EFFORT_OPTIONS.includes(value.level as EffortId) ? value.level as EffortId : 'auto'

  return (
    <div style={cardStyle}>
      <button
        type="button"
        aria-expanded={open}
        style={cardHeaderStyle}
        onClick={() => { setOpen(current => !current) }}
      >
        <span style={cardHeadTextStyle}>
          <div style={cardNameStyle}>{t('card.title')}</div>
          <div style={cardDescStyle}>{t('card.description')}</div>
        </span>
        <svg
          width="16" height="16" viewBox="0 0 16 16" aria-hidden
          style={{ ...cardChevronStyle, transform: open ? 'rotate(180deg)' : 'none' }}
        >
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open
        ? (
          <div style={{ padding: '12px 16px' }}>
            {unavailable
              ? (
                <div style={{ fontSize: '13px', color: 'var(--dsw-alias-label-tertiary)' }}>
                  {t('card.unavailable')}
                </div>
              )
              : (
                <>
                  <div style={rowStyle}>
                    <label htmlFor="plugin-config-thinking-levels-level" style={labelStyle}>{t('card.level')}</label>
                    <select
                      id="plugin-config-thinking-levels-level"
                      value={level}
                      disabled={readonly}
                      style={controlStyle}
                      onChange={(event) => { void scope.set('level', event.currentTarget.value as EffortId) }}
                    >
                      {EFFORT_OPTIONS.map((option) => (
                        <option key={option} value={option}>{t(`card.level.${option}`)}</option>
                      ))}
                    </select>
                  </div>
                  <ToggleRow
                    id="plugin-config-thinking-levels-enabled"
                    label={t('card.enabled')}
                    checked={value.enabled ?? true}
                    disabled={readonly}
                    onChange={(next) => { void scope.set('enabled', next) }}
                  />
                  <ToggleRow
                    id="plugin-config-thinking-levels-downgrade"
                    label={t('card.allowDowngrade')}
                    checked={value.allowDowngrade ?? true}
                    disabled={readonly || value.level !== 'auto'}
                    onChange={(next) => { void scope.set('allowDowngrade', next) }}
                  />
                  <ToggleRow
                    id="plugin-config-thinking-levels-upgrade"
                    label={t('card.allowUpgrade')}
                    checked={value.allowUpgrade ?? false}
                    disabled={readonly || value.level !== 'auto'}
                    onChange={(next) => { void scope.set('allowUpgrade', next) }}
                  />
                  {!snapshot.writable
                    && <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)' }}>{t('card.readonly')}</p>}
                  <ModelCapabilities scope={piAiScope} t={t} readonly={readonly} />
                </>
              )}
          </div>
        )
        : null}
    </div>
  )
}
