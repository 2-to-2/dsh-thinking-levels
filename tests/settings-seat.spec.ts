/**
 * Settings-seat contract pin for dsh-thinking-levels.
 *
 * This spec locks WHERE the browser half mounts its settings card. The seat
 * has already migrated twice (settings.plugin.item is the 0.1.2–0.1.6 card
 * seat; a settings.plugins.tab registration on the 0.1.5 line minted a
 * duplicate top-level Plugins tab and was removed in 2.0.0-beta.4). When a
 * future DSH line moves the seat again, migrate src/client/index.ts AND this
 * file together — the assertions below fail on any drift:
 *
 *   - exactly ONE settings seat is registered (no duplicate surfaces);
 *   - the seat is `settings.plugin.item`, keyed+id'd by the namespace, so the
 *     card renders inside the host's built-in configurable Plugins tab;
 *   - `settings.plugins.tab` / `settings.section` stay UNTOUCHED.
 */
import { describe, expect, it } from 'vitest'
import { apply, inject } from '../src/client/index.ts'
import { ThinkingLevelsCard } from '../src/client/card.tsx'

interface CapturedRegistration {
  readonly slot: string
  readonly options: Record<string, unknown>
  readonly component: unknown
}

/** Drive apply against a stub host and capture every slot registration. */
function collectRegistrations(): { declared: string[]; registrations: CapturedRegistration[] } {
  const declared: string[] = []
  const registrations: CapturedRegistration[] = []
  const ctx = {
    effect: (build: () => unknown) => { void build(); return () => {} },
    locale: { register: () => () => {}, bind: () => (key: string) => key },
    settingsScope: { bind: <T,>(_spec: { namespace: string }) => ({ ns: Symbol('scope') }) as unknown as T },
    slots: {
      inject: (slot: string, factory: () => (() => void) | Generator<() => void>) => {
        declared.push(slot)
        const result = factory()
        const steps: Iterable<() => void> = typeof (result as IteratorObject)?.[Symbol.iterator] === 'function'
          ? (result as Generator<() => void>)
          : [result as () => void]
        for (const step of steps) { void step }
        return () => {}
      },
      register: (options: Record<string, unknown>, component: unknown) => {
        registrations.push({ slot: String(options['name']), options, component })
        return () => {}
      },
    },
  }
  apply(ctx as never)
  return { declared, registrations }
}

describe('settings-seat contract (single settings.plugin.item card)', () => {
  it('declares the services apply consumes (cordis waits; no lazy-get race)', () => {
    expect(inject).toEqual(['slots', 'locale', 'settingsScope'])
  })

  it('injects exactly two seats: the settings card plus the composer quick control', () => {
    const { declared, registrations } = collectRegistrations()
    expect(declared).toEqual(['settings.plugin.item', 'conversation.input.right'])
    expect(registrations.filter(r => r.slot === 'settings.plugin.item')).toHaveLength(1)
    expect(registrations.filter(r => r.slot === 'conversation.input.right')).toHaveLength(1)
  })

  it('pins the item-card options (namespace identity + inject factory + card component)', () => {
    const { registrations } = collectRegistrations()
    const { options, component } = registrations[0]!
    expect(options['id']).toBe('thinking-levels')
    expect(options['key']).toBe('thinking-levels') // CLI keyed seat; id covers Desktop list
    expect(options['locale']).toBe('thinking-levels')
    expect(typeof options['inject']).toBe('function')
    // The injected face binds the plugin namespace plus the llm-pi-ai namespace.
    const face = (options['inject'] as () => Record<string, unknown>)()
    expect(Object.keys(face).sort()).toEqual(['piAiScope', 'scope'])
    expect(component).toBe(ThinkingLevelsCard)
  })

  it('never mints a dedicated Plugins tab or a standalone settings section', () => {
    const { declared } = collectRegistrations()
    expect(declared).not.toContain('settings.plugins.tab')
    expect(declared).not.toContain('settings.section')
  })
})
