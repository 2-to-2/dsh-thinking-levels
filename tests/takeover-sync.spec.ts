import { describe, expect, it } from 'vitest'
import {
  declaresThinking,
  identifyTakeoverProviders,
  isCustomOpenAiGateway,
  nextTakeoverSection,
  takeoverProvidersOf,
  type PiAiSection,
  type TakeoverSection,
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

describe('nextTakeoverSection', () => {
  const base: TakeoverSection = { enabled: false, providers: [] }

  it('enables and appends identified providers', () => {
    expect(nextTakeoverSection(base, ['local35b'])).toEqual({ enabled: true, providers: ['local35b'] })
  })

  it('merges with an existing manual list without duplication', () => {
    const prev: TakeoverSection = { enabled: true, providers: ['manual'] }
    expect(nextTakeoverSection(prev, ['local35b', 'local35b']))
      .toEqual({ enabled: true, providers: ['manual', 'local35b'] })
  })

  it('returns the previous section unchanged when nothing is identified', () => {
    expect(nextTakeoverSection(base, [])).toBe(base)
  })

  it('returns the previous section unchanged when already covered', () => {
    const prev: TakeoverSection = { enabled: true, providers: ['local35b'] }
    expect(nextTakeoverSection(prev, ['local35b'])).toBe(prev)
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
