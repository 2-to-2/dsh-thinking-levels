# Findings — DSH 0.1.5-rc 升级兼容（2026-09-13）

> 证据来源：npm `@deepseek-ai/*@0.1.5-rc.2` 解包 .d.ts 探针（/tmp/dsh-probe）+ `dsh-docs-deliverables` 知识库。

## 0.1.5-rc.2 契约证据
- `dsh-client-ui-settings/lib/types/client/contract/slots.d.ts`：声明 `settings.action` / `settings.close` / `settings.section` / `settings.plugins.tab` / `settings.onboarding` / `settings.general.item` —— **无 `settings.plugin.item`**。`settings.plugins.tab` 为 list 槽，注释明确：*Options: `id` (tab key), `order`, `label` (registrant-localized tab text)... the section supplies nothing... your own inject face*。
- `dsh-client-ui-slots/lib/types/index.d.ts`：`SlotLabel = string | (() => string)`；`register` 仍支持 `inject: (...args) => I` 业务面工厂 + `locale` 选项 + `id`/`key` 按 kind 校验。
- `dsh-client-ui-conversation/.../contract/slots.d.ts:208`：`conversation.input.right` 仍为 list/session 槽，注释「Compact controls before the composer submit action」。
- `dsh-settings/lib/types/index.d.ts`：`register(ns, schema, options?)`（ns 须为小写连字符标识符，否则 TypeError）、`installSection(owner, ns, schema, entry, hooks)`、`get(ns)`、`update(ns, patch, expectedRevision?)` 均在；`SettingsScope` 仍有 `get()/watch(cb)/update(patch)`。
- `dsh-settings/lib/types/types.d.ts:101`：`'settings/document-updated'(ns, revision)`。
- `dsh-client-locale/lib/types/client/index.d.ts:188,198`：`register(ns, dicts)` 与 `register(ns, locale, dict)` 双 overload 均在。
- `dsh-client-ui-settings/lib/types/client/settings-scope.d.ts:90`：`settingsScope: SettingsScopeBinder` 仍在。

## 回退探测方案
- `ctx.slots.entries(key)` 对未声明 key 返回空数组（ui-slots index.d.ts `entries()` 注释：*empty for keys not (or no longer) declared*）。但「空」也可能因为声明该槽的宿主插件尚未加载（load order 问题）。
- 因此采用 **try 模式**：优先按 0.1.5 契约注册 `settings.plugins.tab`；若 `slots.register` 因槽未声明抛错（或注册后 `isLive` 为 false），catch 后回退注册 `settings.plugin.item`。插件已有「CLI 与 Desktop 声明不同 kind，同时带 id+key」的先例（src/client/index.ts 注释），双槽位注册是同一兼容思路的延续。
- 备选：同时注册两个槽位——旧宿主忽略未声明槽（entries 空数组不渲染，无副作用），新宿主同理忽略 `settings.plugin.item`。实现更简单（无需 try/catch），先验证旧宿主对未声明槽注册是否静默容忍，若不容忍再用 try/catch。

## 升级陷阱对照（来自 knowledge base `plugin-framework/upgrade-pitfalls.md`）
- 本插件**不写** session source kind / marker → §1（会话拒载）不适用。
- 本插件**不用** RPC/HTTP 通道 → §2.1/2.2 不适用。
- 客户端 bundle 无 eager 重依赖（locale 字典 + React 组件）→ §3.2 不适用。
- §4.1（配置字段重命名无迁移）：本次不改 Config schema 字段，无风险。
- §3.1（client combo 缓存陈旧）：**适用**——升级用户可能报「插件卡片消失」，需写进 README 排障。
- #6221（settings 写入删除同命名空间外部编辑）：`takeover-sync` 的 `update(PI_AI_NAMESPACE, {providers})` 整节 patch 在 0.1.5 的合并语义下仍在，但新增 `expectedRevision` 可选参数可用于乐观并发（本轮不启用，YAGNI；记录为后续可选）。

## 风险识别
- `agent/request` waterfall 与 `session.events` 的 `tool/call` 形状属 core 包（@deepseek-ai/dsh-agent 等），探针未覆盖；由「升级 devDeps 后 typecheck + vitest（session-events 有专门护栏测试）+ 实机冒烟」三重验证兜底。
- `settings.plugins.tab` 的 `label` 是注册方本地化文本（旧宿主是 `locale: NS` 让 owner 用字典渲染 tab 文案）；新契约要求注册时给 `label`，可用 `() => string` 工厂配合 `ctx.locale` 读取当前语言，locale 切换时需重注册（ui-settings 注释确认：*the registrant re-registers with fresh text on locale change*）。
