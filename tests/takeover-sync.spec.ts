import { describe, expect, it } from 'vitest'
import {
  declaresThinking,
  identifyTakeoverProviders,
  isCustomOpenAiGateway,
  takeoverProvidersOf,
  withDeveloperRoleDisabled,
  type PiAiSection,
} from '../src/takeover-sync.ts'

const customThinkingProvider = {
  local35b: {
    api: 'openai-completions',
    baseURL: 'http://192.168.100.242:8200/v1',
    models: [
      { id: 'Qwen3.6-35B-A3B', reasoningEfforts: { off: null, high: 'high' } },
    ],
  },
}

describe('isCustomOpenAiGateway', () => {
  it('explicit api: openai-completions is custom', () => {
    expect(isCustomOpenAiGateway({ api: 'openai-completions', baseURL: 'http://x/v1' })).toBe(true)
  })

  it('a non-official baseURL without api field is custom', () => {
    expect(isCustomOpenAiGateway({ baseURL: 'http://192.168.100.242:8200/v1' })).toBe(true)
  })

  it('official hosts are not custom', () => {
    expect(isCustomOpenAiGateway({ baseURL: 'https://api.openai.com/v1' })).toBe(false)
    expect(isCustomOpenAiGateway({ baseURL: 'https://api.deepseek.com/v1' })).toBe(false)
    expect(isCustomOpenAiGateway({ baseURL: 'https://openrouter.ai/api/v1' })).toBe(false)
  })

  it('a route with neither api nor baseURL is not custom (catalog route)', () => {
    expect(isCustomOpenAiGateway({ models: [] })).toBe(false)
    expect(isCustomOpenAiGateway(undefined)).toBe(false)
  })
})

describe('declaresThinking', () => {
  it('true when a model carries a reasoningEfforts table', () => {
    expect(declaresThinking(customThinkingProvider.local35b)).toBe(true)
  })

  it('false when reasoningEfforts is false (thinking off)', () => {
    expect(declaresThinking({ models: [{ id: 'm', reasoningEfforts: false }] })).toBe(false)
  })

  it('false when no models or no table', () => {
    expect(declaresThinking({ models: [{ id: 'm' }] })).toBe(false)
    expect(declaresThinking({ models: [] })).toBe(false)
    expect(declaresThinking(undefined)).toBe(false)
  })
})

describe('identifyTakeoverProviders', () => {
  it('finds custom + thinking providers only', () => {
    const section: PiAiSection = {
      providers: {
        ...customThinkingProvider,
        xiaomi: { apiKeyEnv: 'XIAOMI_API_KEY', models: [{ id: 'mimo-v2.5' }] },
        official: { baseURL: 'https://api.deepseek.com/v1', models: [{ id: 'm', reasoningEfforts: { high: 'high' } }] },
        customNoThink: { api: 'openai-completions', baseURL: 'http://y/v1', models: [{ id: 'm' }] },
      },
    }
    expect(identifyTakeoverProviders(section)).toEqual(['local35b'])
  })

  it('empty when the section is absent or has no providers', () => {
    expect(identifyTakeoverProviders(undefined)).toEqual([])
    expect(identifyTakeoverProviders({})).toEqual([])
  })
})

describe('withDeveloperRoleDisabled', () => {
  it('writes the official flag at route level for identified providers', () => {
    const section: PiAiSection = { providers: { ...customThinkingProvider } }
    const next = withDeveloperRoleDisabled(section)!
    expect(next.providers?.local35b?.compat).toEqual({ supportsDeveloperRole: false })
    // other profile fields survive
    expect(next.providers?.local35b?.baseURL).toBe('http://192.168.100.242:8200/v1')
    expect(next.providers?.local35b?.models).toEqual(customThinkingProvider.local35b.models)
  })

  it('leaves non-identified providers untouched and preserves section identity for them', () => {
    const section: PiAiSection = {
      providers: {
        ...customThinkingProvider,
        official: { baseURL: 'https://api.deepseek.com/v1', models: [{ id: 'm', reasoningEfforts: { high: 'high' } }] },
      },
    }
    const next = withDeveloperRoleDisabled(section)!
    expect(next.providers?.official).toBe(section.providers?.official)
    expect(next.providers?.official?.compat).toBeUndefined()
  })

  it('respects an explicit route-level value (true or false) and is identity then', () => {
    const explicitTrue: PiAiSection = {
      providers: { local35b: { ...customThinkingProvider.local35b, compat: { supportsDeveloperRole: true } } },
    }
    expect(withDeveloperRoleDisabled(explicitTrue)).toBe(explicitTrue)
    const explicitFalse: PiAiSection = {
      providers: { local35b: { ...customThinkingProvider.local35b, compat: { supportsDeveloperRole: false } } },
    }
    expect(withDeveloperRoleDisabled(explicitFalse)).toBe(explicitFalse)
  })

  it('merges into an existing compat object without clobbering siblings', () => {
    const section: PiAiSection = {
      providers: { local35b: { ...customThinkingProvider.local35b, compat: { maxTokensField: 'max_tokens' } } },
    }
    const next = withDeveloperRoleDisabled(section)!
    expect(next.providers?.local35b?.compat).toEqual({ maxTokensField: 'max_tokens', supportsDeveloperRole: false })
  })

  it('never touches model rows (models[] and modelOverrides) — inheritance keeps them authoritative', () => {
    const section: PiAiSection = {
      providers: {
        local35b: {
          ...customThinkingProvider.local35b,
          models: [{ id: 'Qwen3.6-35B-A3B', reasoningEfforts: { off: null, high: 'high' }, compat: { supportsDeveloperRole: true } }],
          modelOverrides: { other: { compat: { supportsDeveloperRole: true } } },
        },
      },
    }
    const next = withDeveloperRoleDisabled(section)!
    const rows = next.providers?.local35b?.models as Array<Record<string, unknown>>
    expect(rows[0]?.compat).toEqual({ supportsDeveloperRole: true })
    expect((next.providers?.local35b?.modelOverrides as Record<string, { compat: unknown }>).other.compat)
      .toEqual({ supportsDeveloperRole: true })
    // route level still filled
    expect(next.providers?.local35b?.compat).toEqual({ supportsDeveloperRole: false })
  })

  it('scans modelOverrides for thinking declaration (models[]-absent routes)', () => {
    const section: PiAiSection = {
      providers: {
        overridesOnly: {
          api: 'openai-completions',
          baseURL: 'http://z/v1',
          modelOverrides: { m: { reasoningEfforts: { high: 'high' } } },
        },
      },
    }
    const next = withDeveloperRoleDisabled(section)!
    expect(next.providers?.overridesOnly?.compat).toEqual({ supportsDeveloperRole: false })
  })

  it('returns the previous section (identity) when nothing to write', () => {
    const empty: PiAiSection = { providers: {} }
    expect(withDeveloperRoleDisabled(empty)).toBe(empty)
    expect(withDeveloperRoleDisabled(undefined)).toBeUndefined()
  })
})

describe('takeoverProvidersOf', () => {
  it('returns the enabled provider list', () => {
    expect(takeoverProvidersOf({ enabled: true, providers: ['local35b', 'other'] }))
      .toEqual(['local35b', 'other'])
  })

  it('returns an empty list when disabled', () => {
    expect(takeoverProvidersOf({ enabled: false, providers: ['local35b'] })).toEqual([])
  })

  it('returns null when the namespace is unregistered (adapter plugin absent)', () => {
    expect(takeoverProvidersOf(undefined)).toBeNull()
  })

  it('filters non-string provider entries', () => {
    expect(takeoverProvidersOf({ enabled: true, providers: ['a', 3, null] })).toEqual(['a'])
  })
})
