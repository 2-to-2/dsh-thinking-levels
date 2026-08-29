/**
 * Thinking-levels settings card — the `settings.plugin.item` face of the
 * dsh-thinking-levels plugin.
 *
 * The card binds the `thinking-levels` settings namespace through the
 * `settingsScope` cordis service and renders its fields: the level picker
 * (off / on / minimal / low / medium / high / xhigh / max / auto) plus the
 * scheduler toggles. Every change commits immediately through the scope (no
 * staged form): the decision is read per model request, so a committed change
 * applies to the next request without a restart.
 *
 * Below the scheduler rows, a "model capabilities" block edits the
 * `llm-pi-ai` namespace directly (read + write through the same settings
 * transport), borrowing dsh-thinking-effort's presentation: providers group
 * their models, each model row shows capability badges and expands into a
 * per-level editor where a level is ticked and its gateway wire value entered
 * (e.g. `high` → `ultra`); `off` left empty means "do not send". A search box
 * filters models and one-click presets apply official/generic level sets to
 * every thinking model.
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
  /**
   * The `llm-openai-completions` takeover list, read so the model editor
   * surfaces only routes the openai-completions adapter actually serves.
   */
  takeoverScope: SettingsScope<unknown>
}

/** Full props: locale seat + the injected scopes. */
export type ThinkingLevelsCardProps = PropsLocale<'thinking-levels'> & ThinkingLevelsCardInjected

/** The user-facing levels, in picker order: eight standard levels plus the auto scheduler sentinel. */
const EFFORT_OPTIONS: readonly EffortId[] = [
  'off', 'on', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'auto',
]

/**
 * The levels the capability editor offers. This is the llm-pi-ai
 * `reasoningEfforts` table-key space — pi-ai's fixed seven levels (schema
 * rejects any other key). `on` (the enable-thinking toggle) is a selector /
 * injection-level concept, expressed here by the `off` + `high` pair
 * (enable_thinking false/true), so it has no table key of its own.
 */
const CAPABILITY_LEVELS: readonly EffortId[] = [
  'off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max',
] as const

/** One-click presets, mirroring dsh-thinking-effort: official DeepSeek style and a generic set. */
const PRESETS: readonly { key: 'official' | 'generic'; levels: Record<string, unknown> }[] = [
  { key: 'official', levels: { off: null, high: 'high', max: 'max' } },
  { key: 'generic', levels: { off: null, low: 'low', medium: 'medium', high: 'high' } },
]

/** The wire thinking formats offered (llm-pi-ai's nameable set, incl. qwen-chat-template). */
const THINKING_FORMATS = [
  'openai', 'deepseek', 'openrouter', 'together', 'zai', 'qwen',
  'qwen-chat-template', 'string-thinking', 'ant-ling',
] as const

/* ── shared row styling (inline; keeps the client bundle CSS-free) ──────── */

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

const fieldStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px' }

const fieldLabelStyle: CSSProperties = { margin: 0, fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' }

const hintStyle: CSSProperties = { margin: '6px 0 0', fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' }

/** Provider group shell: an outlined row grouping its models. */
const providerStyle: CSSProperties = {
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: '8px',
  margin: '8px 0 0',
  overflow: 'hidden',
}

const providerHeadStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '7px 10px',
  background: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.06))',
}

const providerNameStyle: CSSProperties = {
  margin: 0,
  flex: '1 1 auto',
  minWidth: 0,
  fontFamily: 'var(--ds-font-family-code, monospace)',
  fontSize: '12px',
  lineHeight: '18px',
  fontWeight: 600,
  color: 'var(--dsw-alias-label-primary)',
  overflowWrap: 'anywhere',
}

const providerBadgeStyle: CSSProperties = {
  margin: 0,
  fontSize: '10px',
  lineHeight: '16px',
  color: 'var(--dsw-alias-label-tertiary)',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: '4px',
  padding: '0 5px',
  whiteSpace: 'nowrap',
}

const iconButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--dsw-alias-label-tertiary)',
  cursor: 'pointer',
  padding: '2px 4px',
  display: 'inline-flex',
  alignItems: 'center',
}

/** One model row inside a provider group. */
const modelRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '7px 10px',
  borderTop: '1px solid var(--dsw-alias-border-l2)',
}

const modelIdStyle: CSSProperties = {
  margin: 0,
  flex: '1 1 auto',
  minWidth: 0,
  fontFamily: 'var(--ds-font-family-code, monospace)',
  fontSize: '12px',
  lineHeight: '18px',
  color: 'var(--dsw-alias-label-secondary)',
  overflowWrap: 'anywhere',
}

/** Capability badge chips (text / image / context). */
const badgeStyle: CSSProperties = {
  fontSize: '10px',
  lineHeight: '16px',
  color: 'var(--dsw-alias-label-tertiary)',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: '4px',
  padding: '0 5px',
  whiteSpace: 'nowrap',
}

/** The per-level editor grid: one row per level with a toggle, a label and a wire input. */
const levelRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 92px minmax(0, 1fr)',
  alignItems: 'center',
  gap: '8px',
  padding: '4px 0',
  fontSize: '13px',
}

const levelNameStyle: CSSProperties = { margin: 0, fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-secondary)' }

const wireInputStyle: CSSProperties = {
  background: 'var(--dsw-alias-bg-surface, #fff)',
  color: 'var(--dsw-alias-label-primary)',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: '4px',
  padding: '3px 8px',
  fontSize: '12px',
  width: '100%',
  boxSizing: 'border-box',
}

/* ── helpers over the llm-pi-ai user layer ─────────────────────────────── */

/** A row's `reasoningEfforts` as stored in the user layer. */
function effortsOf(model: Record<string, unknown>): false | Record<string, unknown> | undefined {
  const value = model['reasoningEfforts']
  if (value === false) return false
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return undefined
}

/**
 * Build a `reasoningEfforts` table from a level→wire draft. `off` maps to
 * `null` (omit the reasoning option → enable_thinking false) unless the user
 * typed a wire value; every other ticked level keeps its typed wire value.
 * pi-ai rejects a table offering nothing beyond `off`, so a selection of only
 * `off` falls back to the default `high` level.
 */
function effortTableOf(draft: Record<string, string | null>): Record<string, unknown> {
  const table: Record<string, unknown> = {}
  for (const level of CAPABILITY_LEVELS) {
    const wire = draft[level]
    if (wire === undefined || wire === null) continue
    const trimmed = typeof wire === 'string' ? wire.trim() : ''
    if (level === 'off') table[level] = trimmed === '' ? null : trimmed
    else if (trimmed !== '') table[level] = trimmed
  }
  if (Object.keys(table).length === 0 || Object.keys(table).every(level => table[level] === null)) {
    return { ...table, high: 'high' }
  }
  return table
}

/** The `compat.thinkingFormat` a row declares, or `undefined` when it declares none. */
function formatOf(model: Record<string, unknown>): string | undefined {
  const compat = model['compat']
  if (typeof compat !== 'object' || compat === null || Array.isArray(compat)) return undefined
  const format = (compat as Record<string, unknown>)['thinkingFormat']
  return typeof format === 'string' ? format : undefined
}

/** Whether a row declares `compat.supportsReasoningEffort` (the wire sends reasoning_effort). */
function supportsEffortOf(model: Record<string, unknown>): boolean {
  const compat = model['compat']
  if (typeof compat !== 'object' || compat === null || Array.isArray(compat)) return false
  return (compat as Record<string, unknown>)['supportsReasoningEffort'] === true
}

/** Patch one row's `compat` object, merging rather than replacing sibling fields. */
function patchCompat(
  row: Record<string, unknown>,
  patch: (compat: Record<string, unknown>) => void,
): void {
  const compat = typeof row['compat'] === 'object' && row['compat'] !== null && !Array.isArray(row['compat'])
    ? { ...(row['compat'] as Record<string, unknown>) }
    : {}
  patch(compat)
  if (Object.keys(compat).length === 0) delete row['compat']
  else row['compat'] = compat
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

/** The provider ids the openai-completions adapter is set up to serve. */
function takeoverListOf(snapshot: unknown): string[] {
  if (typeof snapshot !== 'object' || snapshot === null) return []
  const value = (snapshot as { value?: unknown }).value
  if (typeof value !== 'object' || value === null) return []
  const section = value as { enabled?: unknown; providers?: unknown }
  if (section.enabled !== true || !Array.isArray(section.providers)) return []
  return section.providers.filter((id): id is string => typeof id === 'string')
}

/** One flattened capability entry: a provider's model at an array index. */
interface CapabilityEntry {
  providerId: string
  index: number
  model: Record<string, unknown>
  modelId: string
}

/** Flatten the user-layer providers into capability entries (models arrays only). */
function entriesOf(providers: Record<string, unknown>): CapabilityEntry[] {
  return Object.entries(providers).flatMap(([providerId, profile]) => {
    const models = (profile as Record<string, unknown>)['models']
    if (!Array.isArray(models)) return []
    return models.map((model, index) => ({
      providerId,
      index,
      model: (typeof model === 'object' && model !== null && !Array.isArray(model)
        ? model as Record<string, unknown>
        : {}),
      modelId: typeof model === 'object' && model !== null && typeof (model as Record<string, unknown>)['id'] === 'string'
        ? (model as Record<string, unknown>)['id'] as string
        : `#${index + 1}`,
    }))
  })
}

/** Human-readable capability summary of one entry (input modalities + declared context window). */
function summaryOf(entry: CapabilityEntry): { text: boolean; image: boolean; context: string | null } {
  const input = entry.model['input']
  const text = !Array.isArray(input) || input.length === 0 || input.includes('text')
  const image = Array.isArray(input) && input.includes('image')
  const contextWindow = entry.model['contextWindow']
  let context: string | null = null
  if (typeof contextWindow === 'number' && Number.isFinite(contextWindow) && contextWindow > 0) {
    context = contextWindow >= 1024
      ? `${Math.round(contextWindow / 1024)}K`
      : String(contextWindow)
  }
  return { text, image, context }
}

/** A tiny inline chevron icon (no CSS modules). */
function ChevronIcon({ open }: { open: boolean }): JSX.Element {
  return (
    <svg
      width="12" height="12" viewBox="0 0 16 16" aria-hidden
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.16s' }}
    >
      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * The llm-pi-ai model-capability editor block (dsh-thinking-effort style:
 * provider groups, model rows with badges, per-level wire editors, search and
 * one-click presets).
 * @param scope - the `llm-pi-ai` namespace scope.
 * @param t - copy lookup.
 * @param readonly - whether writes are forbidden.
 * @returns the capabilities block, or a placeholder when nothing is configured.
 */
function ModelCapabilities(props: {
  scope: SettingsScope<unknown>
  takeoverScope: SettingsScope<unknown>
  t: (key: string) => string
  readonly: boolean
}): JSX.Element {
  const { scope, takeoverScope, t, readonly } = props
  const snapshot = useSyncExternalStore(
    (listener) => scope.subscribe(listener),
    () => scope.getSnapshot(),
  )
  const takeover = useSyncExternalStore(
    (listener) => takeoverScope.subscribe(listener),
    () => takeoverScope.getSnapshot(),
  )
  const unavailable = snapshot.status === 'unavailable'
  const providers = snapshot.status === 'ready' ? providersOf(snapshot) : {}
  // Only routes the openai-completions adapter actually serves are editable
  // here: the takeover list (`enabled: true` + provider ids). A provider that
  // pi-ai serves natively (e.g. mimo via xiaomi) is NOT shown — its reasoning
  // stays pi-ai-managed (off/high visible, effort validated by pi-ai).
  const takeoverList = takeover.status === 'ready'
    ? takeoverListOf(takeover)
    : []
  const filteredProviders = takeoverList.length === 0
    ? {}
    : Object.fromEntries(Object.entries(providers).filter(([id]) => takeoverList.includes(id)))
  const allEntries = entriesOf(filteredProviders)

  // UI-only state: provider/model expansion, the wire drafts, and the query.
  const [query, setQuery] = useState('')
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({})
  const [expandedModels, setExpandedModels] = useState<Record<string, boolean>>({})
  const [drafts, setDrafts] = useState<Record<string, Record<string, string | null>>>({})
  const [busy, setBusy] = useState(false)

  const entryKey = (entry: CapabilityEntry): string => `${entry.providerId}\u0000${entry.index}`

  /** Commit one patch over the user-layer providers. */
  const commitProviders = (mutate: (current: Record<string, unknown>) => Record<string, unknown>): void => {
    if (snapshot.status !== 'ready' || readonly) return
    setBusy(true)
    void scope.set('providers', mutate(structuredClone(providers)))
      .then(() => { setBusy(false) })
      .catch(() => { setBusy(false) })
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

  /** Apply one model's wire draft as its `reasoningEfforts` table. */
  const applyDraft = (entry: CapabilityEntry): void => {
    const key = entryKey(entry)
    const draft = drafts[key]
    if (draft === undefined) return
    const table = effortTableOf(draft)
    patchModel(entry.providerId, entry.index, (row) => {
      row['reasoningEfforts'] = table
      // Mark effort support only when the model already had it or the user
      // ticked a reasoning_effort-only level (minimal/low/medium/xhigh/max).
      // A toggle-only model (Qwen3.6: off/high = enable_thinking) must keep
      // supportsReasoningEffort false — flipping it would make the adapter
      // send a reasoning_effort the gateway rejects (400).
      const extended = Object.keys(table).some(level => level !== 'off' && level !== 'on' && level !== 'high')
      if (supportsEffortOf(row) || extended) {
        patchCompat(row, (compat) => {
          compat['supportsReasoningEffort'] = true
        })
      }
    })
  }

  /** Reset a model's draft to its persisted table (or the default high set). */
  const resetDraft = (entry: CapabilityEntry): void => {
    const key = entryKey(entry)
    setDrafts(current => {
      const next = { ...current }
      const table = effortsOf(entry.model)
      if (typeof table === 'object' && table !== null) {
        next[key] = Object.fromEntries(CAPABILITY_LEVELS.map(level => [
          level,
          table[level] === undefined ? null : (table[level] === null ? '' : String(table[level])),
        ]))
      } else {
        next[key] = { off: '', high: 'high' }
      }
      return next
    })
  }

  /** Seed a model's draft when it is first expanded. */
  const ensureDraft = (entry: CapabilityEntry): void => {
    const key = entryKey(entry)
    setDrafts(current => {
      if (current[key] !== undefined) return current
      const next = { ...current }
      const table = effortsOf(entry.model)
      if (typeof table === 'object' && table !== null) {
        next[key] = Object.fromEntries(CAPABILITY_LEVELS.map(level => [
          level,
          table[level] === undefined ? null : (table[level] === null ? '' : String(table[level])),
        ]))
      } else {
        next[key] = { off: '', high: 'high' }
      }
      return next
    })
  }

  /** Apply a one-click preset to every thinking model. */
  const applyPreset = (levels: Record<string, unknown>): void => {
    commitProviders((current) => {
      for (const entry of entriesOf(current)) {
        const profile = current[entry.providerId] as { models?: unknown[] } | undefined
        if (profile === undefined || !Array.isArray(profile.models)) continue
        const model = profile.models[entry.index]
        if (typeof model !== 'object' || model === null) continue
        const row = model as Record<string, unknown>
        if (effortsOf(row) === undefined) continue // only thinking models
        // Replace the table but never touch supportsReasoningEffort: a
        // toggle-only model (Qwen3.6) must stay Off/On (enable_thinking), so
        // the request guard keeps clamping any injected level to its default
        // strength instead of sending a reasoning_effort the gateway rejects.
        row['reasoningEfforts'] = levels
      }
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
  if (allEntries.length === 0) {
    return (
      <div style={sectionStyle}>
        <p style={fieldLabelStyle}>{t('card.capabilities')}</p>
        <p style={hintStyle}>{t('card.capabilities.empty')}</p>
      </div>
    )
  }

  const needle = query.trim().toLowerCase()
  const visible = needle === ''
    ? allEntries
    : allEntries.filter(entry =>
      entry.modelId.toLowerCase().includes(needle)
      || entry.providerId.toLowerCase().includes(needle))
  const providerIds = [...new Set(visible.map(entry => entry.providerId))]

  return (
    <div style={sectionStyle}>
      <p style={fieldLabelStyle}>{t('card.capabilities')}</p>
      <p style={hintStyle}>{t('card.capabilities.hint')}</p>

      {/* Search + one-click presets */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', margin: '8px 0 2px' }}>
        <input
          type="text"
          value={query}
          placeholder={t('card.capabilities.search')}
          disabled={readonly || busy}
          style={{ ...controlStyle, flex: '1 1 160px', minWidth: '140px' }}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        {PRESETS.map(preset => (
          <button
            key={preset.key}
            type="button"
            disabled={readonly || busy}
            onClick={() => applyPreset(preset.levels)}
            style={{
              ...controlStyle,
              cursor: readonly || busy ? 'default' : 'pointer',
              opacity: readonly || busy ? 0.5 : 1,
            }}
          >
            {t(`card.capabilities.preset${preset.key === 'official' ? 'Official' : 'Generic'}`)}
          </button>
        ))}
      </div>

      {visible.length === 0
        ? <p style={hintStyle}>{t('card.capabilities.noMatches')}</p>
        : providerIds.map(providerId => {
          const providerEntries = visible.filter(entry => entry.providerId === providerId)
          const providerOpen = expandedProviders[providerId] === true || needle !== ''
          return (
            <div key={providerId} style={providerStyle}>
              <div style={providerHeadStyle}>
                <button
                  type="button"
                  aria-expanded={providerOpen}
                  disabled={readonly || busy}
                  onClick={() => setExpandedProviders(current => ({
                    ...current,
                    [providerId]: current[providerId] !== true,
                  }))}
                  style={{
                    ...iconButtonStyle,
                    cursor: readonly || busy ? 'default' : 'pointer',
                  }}
                  title={providerOpen ? t('card.capabilities.collapseProvider') : t('card.capabilities.expandProvider')}
                >
                  <ChevronIcon open={providerOpen} />
                </button>
                <p style={providerNameStyle}>{providerId}</p>
                <p style={providerBadgeStyle}>{t('card.capabilities.vendor')} · {providerEntries.length}</p>
              </div>
              {providerOpen
                ? providerEntries.map(entry => {
                  const key = entryKey(entry)
                  const modelOpen = expandedModels[key] === true
                  const efforts = effortsOf(entry.model)
                  const thinking = typeof efforts === 'object'
                  const supportsEffort = supportsEffortOf(entry.model)
                  const meta = summaryOf(entry)
                  const format = formatOf(entry.model)
                  return (
                    <div key={key}>
                      <div style={modelRowStyle}>
                        <button
                          type="button"
                          aria-expanded={modelOpen}
                          disabled={readonly || busy}
                          onClick={() => {
                            const next = expandedModels[key] !== true
                            setExpandedModels(current => ({ ...current, [key]: next }))
                            if (next) ensureDraft(entry)
                          }}
                          style={{
                            ...iconButtonStyle,
                            cursor: readonly || busy ? 'default' : 'pointer',
                          }}
                          title={modelOpen ? t('card.capabilities.closeModelSettings') : t('card.capabilities.openModelSettings')}
                        >
                          <ChevronIcon open={modelOpen} />
                        </button>
                        <p style={modelIdStyle}>{entry.modelId}</p>
                        <span style={badgeStyle} title="text">{meta.text ? 'T' : '–'}</span>
                        <span style={badgeStyle} title="image">{meta.image ? 'IMG' : '–'}</span>
                        {meta.context !== null && <span style={badgeStyle}>{meta.context}</span>}
                        {thinking && !supportsEffort && <span style={badgeStyle}>On/Off</span>}
                      </div>
                      {modelOpen
                        ? (
                          <div style={{ padding: '4px 10px 10px', borderTop: '1px solid var(--dsw-alias-border-l2)' }}>
                            {/* Per-level wire editor */}
                            <p style={fieldLabelStyle}>{t('card.capabilities.efforts')}</p>
                            <div style={{ margin: '4px 0 6px' }}>
                              {CAPABILITY_LEVELS.map(level => {
                                const wire = drafts[key]?.[level]
                                const on = wire !== undefined && wire !== null
                                return (
                                  <div key={level} style={levelRowStyle}>
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                                      <input
                                        type="checkbox"
                                        checked={on}
                                        disabled={readonly || busy}
                                        onChange={(event) => {
                                          const checked = event.currentTarget.checked
                                          setDrafts(current => {
                                            const draft = { ...(current[key] ?? {}) }
                                            draft[level] = checked
                                              ? (level === 'off' ? '' : level)
                                              : null
                                            return { ...current, [key]: draft }
                                          })
                                        }}
                                      />
                                      <span>{level}</span>
                                    </label>
                                    <span style={levelNameStyle}>{level === 'off' ? t('card.capabilities.offPlaceholder') : '→'}</span>
                                    <input
                                      type="text"
                                      value={wire ?? ''}
                                      disabled={readonly || busy || !on}
                                      placeholder={t('card.capabilities.wirePlaceholder')}
                                      style={wireInputStyle}
                                      onChange={(event) => {
                                        setDrafts(current => {
                                          const draft = { ...(current[key] ?? {}) }
                                          draft[level] = event.currentTarget.value
                                          return { ...current, [key]: draft }
                                        })
                                      }}
                                    />
                                  </div>
                                )
                              })}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                disabled={readonly || busy}
                                onClick={() => applyDraft(entry)}
                                style={{
                                  ...controlStyle,
                                  cursor: readonly || busy ? 'default' : 'pointer',
                                  opacity: readonly || busy ? 0.5 : 1,
                                }}
                              >
                                {t('card.capabilities.applyLevel')}
                              </button>
                              <button
                                type="button"
                                disabled={readonly || busy}
                                onClick={() => resetDraft(entry)}
                                style={{
                                  ...controlStyle,
                                  cursor: readonly || busy ? 'default' : 'pointer',
                                  opacity: readonly || busy ? 0.5 : 1,
                                }}
                              >
                                {t('card.capabilities.restoreDefault')}
                              </button>
                            </div>
                            {/* Vision toggle + thinking format */}
                            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '10px' }}>
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                                <input
                                  type="checkbox"
                                  checked={meta.image}
                                  disabled={readonly || busy}
                                  onChange={(event) => {
                                    patchModel(entry.providerId, entry.index, (row) => {
                                      // Image input implies text input; the pair is written together.
                                      row['input'] = event.currentTarget.checked ? ['text', 'image'] : ['text']
                                    })
                                  }}
                                />
                                <span>{t('card.capabilities.vision')}</span>
                              </label>
                              <label style={fieldStyle}>
                                <span style={fieldLabelStyle}>{t('card.capabilities.thinkingFormat')}</span>
                                <select
                                  style={controlStyle}
                                  value={format ?? 'inherit'}
                                  disabled={readonly || busy}
                                  onChange={(event) => {
                                    const next = event.currentTarget.value
                                    patchModel(entry.providerId, entry.index, (row) => {
                                      patchCompat(row, (compat) => {
                                        if (next === 'inherit') delete compat['thinkingFormat']
                                        else compat['thinkingFormat'] = next
                                      })
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
                          </div>
                        )
                        : null}
                    </div>
                  )
                })
                : null}
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
export function ThinkingLevelsCard({ t, scope, piAiScope, takeoverScope }: ThinkingLevelsCardProps): JSX.Element {
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
    <div style={{
      border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35))',
      background: 'var(--dsw-alias-bg-layer-3, rgba(127,127,127,0.05))',
      borderRadius: '12px',
      transition: 'border-color 0.16s, background 0.16s',
    }}>
      <button
        type="button"
        aria-expanded={open}
        style={{
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
        }}
        onClick={() => { setOpen(current => !current) }}
      >
        <span style={{ flex: '1 1 0%', minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }}>{t('card.title')}</div>
          <div style={{ color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))', fontSize: '13px', lineHeight: 1.5 }}>{t('card.description')}</div>
        </span>
        <svg
          width="16" height="16" viewBox="0 0 16 16" aria-hidden
          style={{
            color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))',
            flex: '0 0 auto',
            transition: 'transform 0.16s',
            transform: open ? 'rotate(180deg)' : 'none',
          }}
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
                  <div style={rowStyle}>
                    <label htmlFor="plugin-config-thinking-levels-enabled" style={labelStyle}>{t('card.enabled')}</label>
                    <input
                      id="plugin-config-thinking-levels-enabled"
                      type="checkbox"
                      checked={value.enabled ?? true}
                      disabled={readonly}
                      onChange={(event) => { void scope.set('enabled', event.currentTarget.checked) }}
                    />
                  </div>
                  <div style={rowStyle}>
                    <label htmlFor="plugin-config-thinking-levels-downgrade" style={labelStyle}>{t('card.allowDowngrade')}</label>
                    <input
                      id="plugin-config-thinking-levels-downgrade"
                      type="checkbox"
                      checked={value.allowDowngrade ?? true}
                      disabled={readonly || value.level !== 'auto'}
                      onChange={(event) => { void scope.set('allowDowngrade', event.currentTarget.checked) }}
                    />
                  </div>
                  <div style={rowStyle}>
                    <label htmlFor="plugin-config-thinking-levels-upgrade" style={labelStyle}>{t('card.allowUpgrade')}</label>
                    <input
                      id="plugin-config-thinking-levels-upgrade"
                      type="checkbox"
                      checked={value.allowUpgrade ?? false}
                      disabled={readonly || value.level !== 'auto'}
                      onChange={(event) => { void scope.set('allowUpgrade', event.currentTarget.checked) }}
                    />
                  </div>
                  {!snapshot.writable
                    && <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)' }}>{t('card.readonly')}</p>}
                  <ModelCapabilities scope={piAiScope} takeoverScope={takeoverScope} t={t} readonly={readonly} />
                </>
              )}
          </div>
        )
        : null}
    </div>
  )
}
