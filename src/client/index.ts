/**
 * dsh-thinking-levels — browser half.
 *
 * Registers the `thinking-levels` dictionaries and one `settings.plugin.item`
 * card keyed by the plugin's settings namespace, so the shared Plugins
 * settings tab renders an editable card: the level picker (off / low / high /
 * max / auto) plus the scheduler toggles.
 *
 * All @deepseek-ai/* imports are type-only: collaboration happens through
 * cordis services (`settingsScope`) and slot registration only (client bundle
 * purity).
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ThinkingLevelsConfig } from '../index.ts'
import { NS, en, ja, ko, zh } from './locales.ts'
import { ThinkingLevelsCard, type ThinkingLevelsCardInjected } from './card.tsx'

/** The settings namespace the host half registers (kept in lockstep with src/index.ts). */
const THINKING_LEVELS_NS = 'thinking-levels'

/** Services required by the browser half. */
export const inject = ['slots', 'locale', 'settingsScope']

/**
 * Client plugin body: dictionaries plus the settings card registration.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  // `register(ns, dicts)` is typed to the built-in locale ids (`zh` / `en`
  // only); the shipped `ja` / `ko` dictionaries go through the single-locale
  // overload, so they are installed and ready once DSH publishes those ids.
  ctx.effect(() => {
    const disposers = [
      ctx.locale.register(NS, { zh, en }),
      ctx.locale.register(NS, 'ja', ja),
      ctx.locale.register(NS, 'ko', ko),
    ]
    return () => { for (const dispose of disposers) dispose() }
  }, 'dsh-thinking-levels: dictionaries')

  ctx.slots.inject('settings.plugin.item', function* () {
    yield ctx.slots.register({
      name: 'settings.plugin.item',
      // Both keys are supplied: CLI dsh declares this slot `keyed` (needs
      // `key`) while DSH Desktop's bundled version declares it `list` (needs
      // `id`) — the slots service validates only its kind's field, so the
      // pair keeps the card working in both environments.
      id: THINKING_LEVELS_NS,
      key: THINKING_LEVELS_NS,
      locale: NS,
      inject: (): ThinkingLevelsCardInjected => {
        const scope = ctx.settingsScope.bind<ThinkingLevelsConfig>({ namespace: THINKING_LEVELS_NS })
        // The llm-pi-ai namespace is bound read/write so the card can surface
        // and edit custom-provider model capabilities (vision / thinking /
        // effort levels / thinking format / the route-level official
        // compat.supportsDeveloperRole flag) without touching any official
        // package — llm-pi-ai's own schema validates every write.
        const piAiScope = ctx.settingsScope.bind<unknown>({ namespace: 'llm-pi-ai' })
        return { scope, piAiScope }
      },
    }, ThinkingLevelsCard)
  })
}
