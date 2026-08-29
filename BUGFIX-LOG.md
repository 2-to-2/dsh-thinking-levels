# dsh-thinking-levels 修复记录

本文档记录 dsh-thinking-levels 从 v0.1.0 到 v0.4.1 的全部 bug 修复过程：问题现象、根因、修复方案与验证结果。

---

## v0.1.0 → v0.1.1 — Node 22 禁止加载 node_modules 下的 .ts

- **版本**：v0.1.0（问题）/ v0.1.1（修复）
- **现象**：`dsh web` 启动报 `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`，插件无法加载。
- **根因**：v0.1.0 以纯 TS 源码分发（`main` 指向 `src/index.ts`）。Node 22 出于安全原因明确禁止 type-stripping 加载 `node_modules` 下的 `.ts` 文件。
- **修复**：
  - 新增 `tsconfig.build.json`（`rewriteRelativeImportExtensions` 把源码 `.ts` 相对导入改写为 `.js`），编译产物到 `lib/`。
  - `package.json` 的 `main` / `types` / `exports` 指向 `lib/*`；`files` 白名单含 `lib/`。
  - 新增 `prepublishOnly` 构建钩子。
- **验证**：`node import lib/index.js` 成功；`npm pack --dry-run` 确认 tarball 含 `lib/`（`.gitignore` 的 `lib/` 不阻止 files 白名单）。

---

## pnpm 11 供应链冷却期 — minimumReleaseAge

- **现象**：`dsh plugin add dsh-thinking-levels@新版本 -w` 报 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`。
- **根因**：dsh 运行环境实际使用 pnpm 11.22.0（非 PATH 上的 9.15.6），默认开启 `minimumReleaseAge: 1440`（新发布包 24h 冷却期，防供应链攻击）。
- **修复**：在 `~/.dsh/profiles/web/pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude` 加入每个新版本：
  ```yaml
  minimumReleaseAgeExclude:
    - dsh-thinking-levels@0.1.0 || 0.1.1 || 0.2.0 || 0.2.1 || 0.3.0 || 0.3.1 || 0.4.0 || 0.4.1
  ```
- **附带**：`node-pty` 原生模块构建脚本被 `allowBuilds` 拦截 → `pnpm-workspace.yaml` 加 `allowBuilds: node-pty: true`。

---

## host 加载失败根因 — @deepseek-ai/dsh-settings 值依赖（0.4.0 根治）

- **版本**：v0.1.1 引入问题，v0.4.0 根治。
- **现象**：插件在插件列表显示"已停用/未挂载"、无错误信息；client 入口不进 `__DSH_BOOT__`；`/plugins/dsh-thinking-levels/client.js` 404。
- **根因**：host `lib/index.js` 值导入 `@deepseek-ai/dsh-settings`，但官方包**默认不在 profile 的 hoisted node_modules 中**（从 dsh 全局嵌套解析，CLI 的 ESM 树够不到）→ import 失败 → fiber 不建立 → `ClientModuleRegistry`（要求 `entry.fiber !== void 0 && !entry.disabled`）跳过该插件。
- **临时方案（后被取代）**：把 `@deepseek-ai/dsh-settings` 装入 profile 作普通依赖。**问题**：插件列表出现"已安装但未成为 profile 层"的困惑条目，且产生双实例/版本漂移风险（profile rc.6 vs dsh 全局 rc.7）。
- **根治（v0.4.0）**：host 端**不再值依赖** dsh-settings——
  - 官方 `installSettingsSection` / `settingsNamespace` 改为本地实现：`ctx.inject(['settings'])` → `sctx.settings.register(ns, schema, { base: entry })` + `scope.get()/watch()` + `sctx.effect` disposer；namespace 为本地字符串常量。
  - `peerDependencies` 精简为仅 `@deepseek-ai/cordis`。
  - profile 彻底移除 `@deepseek-ai/dsh-settings`（含 rc.6 旧版）。
- **验证**：profile 无 dsh-settings 时 `import('dsh-thinking-levels')` 成功导出 `Config, DEFAULT_CONFIG, THINKING_LEVELS_SETTINGS_NAMESPACE, apply`。
- **教训**：host 插件应避免值依赖官方 `@deepseek-ai` 包，通过 cordis 服务注入；官方包不在 profile 解析树是设计使然。

---

## client 发现 — exports["./client"] 必需

- **版本**：v0.2.0 引入，v0.2.1 修复。
- **现象**：client 入口不进 `__DSH_BOOT__`，`/plugins/dsh-thinking-levels/client.js` 404。
- **根因**：dsh client-modules 的 `clientExportOf` 通过解析包的 `exports["./client"]` 发现 client bundle；缺失时该包被判为"非 client 包"（静默失败）。
- **修复**：`package.json` 的 `exports` 增加 `"./client": { "default": "./lib/client.js" }`。
- **验证**：`__DSH_BOOT__` 出现 client 入口，bundle 路由 200。

---

## UI 位置与用户预期不符 — 模型选择器 Auto（v0.3.0）

- **版本**：v0.3.0。
- **背景**：用户明确要求档位控件出现在**会话模型选择器（模型旁）**，而非设置面板；且 `auto` 应是 **mask**（显示 auto，实际提交时由插件按上下文解析为 low/high/max）。
- **模型目录数据流**（注入点调研）：
  ```
  client ModelDirectory.load() → sessions.models remote
    → dsh-host-apiproxy buildModelCatalog → ctx.llm.resolveModelInfo
      → llm.adapters registration → adapter.resolveModel（efforts 列表）
  ```
  模型选择器的档位选项 = `model.reasoning.efforts`，无 slot 可覆盖。
- **注入 Auto**：包装每个 `llm.adapters` registration 的 `adapter.resolveModel`，向 `reasoning.efforts` 追加 `{ id: 'auto', name: 'Auto' }`（同时让 `resolveCallFor` 的 efforts 校验放行）。
- **关键 bug（agent/request 覆盖）**：dsh-agent 在 `agent/request` 事件里用会话模型选择结果**覆盖** `reasoningEffort`（`next()` 之后）；普通注册的插件 listener 在事件链内层，修改被丢弃 → **v0.2.x 的拦截从未生效**。修复：`ctx.on('agent/request', handler, { prepend: true })`（最外层 listener 最后执行，最终值生效；官方 dsh-llm invariant 同款用法）。
- **决策语义**：模型选择器选 wire 档位（off/low/high/max）→ 尊重；选 `auto` → 插件按工具历史 + 升降档开关调度；未选 → 插件默认档位（默认 auto）。

---

## 桌面版 slot 声明差异 — settings.plugin.item keyed vs list

- **版本**：v0.3.0 引入，v0.4.0 修复。
- **现象**：DSH Desktop 启动报 `failed to apply loader entry (dsh-thinking-levels): list slot "settings.plugin.item" requires options.id`。
- **根因**：两个环境的 slot 声明不一致——
  - CLI 版 dsh 0.1.0-rc.7：`settings.plugin.item` 为 `kind: "keyed"`（注册用 `key`）
  - DSH Desktop 内置版：`kind: "list"`（注册用 `id`）
- **修复**：注册时**同时提供 `id` 与 `key`**（slots 服务只校验自己 kind 的字段，两者共存不冲突），双环境兼容。

---

## Auto 档位不显示 — adapter 包装时序（v0.4.1）

- **版本**：v0.4.0 引入，v0.4.1 修复。
- **现象**：模型选择器只有 Off/Low/High/Max，无 Auto；插件本身已启用已挂载无错误，设置卡片正常（默认档位含 auto）。
- **根因**：`advertiseAutoEffort` 只在插件 apply 时**同步遍历一次** `llm.adapters`；当 llm adapter 注册**晚于插件 apply**（DSH Desktop 加载顺序）时，遍历到空 Map，包装永不执行。
- **修复**：监听 `llm/adapters-updated` 事件，**每次 adapter 注册/替换后重新包装**（响应式）：
  ```ts
  advertiseAutoEffort(ctx.get('llm'))
  ctx.on('llm/adapters-updated', () => {
    advertiseAutoEffort(ctx.get('llm'))
  })
  ```
- **附带**：profile 升级时 dsh-at-file 的 GitHub tarball 下载报 `UND_ERR_DESTROYED`（网络问题）→ 设置 `HTTP_PROXY`/`HTTPS_PROXY=127.0.0.1:30987` 重试成功。
- **教训**：对 dsh 运行时注册表（llm adapters 等）的钩子要用 `*-updated` 事件驱动，而非 apply 时快照；CLI 与桌面版的加载顺序不同。

---

## v0.5.0 — 模型能力感知：不支持的 effort 字段绝不乱传（含 rc6 low 显示/透传）

- **背景（用户报告）**：插件对每次 `agent/request` 无条件注入 `reasoningEffort`，把 `low` 强制打进不支持的模型（自定义 llm-pi-ai / openai-completions 的 Qwen3.6-35B-A3B，未声明 `reasoningEfforts` → dsh 判定非推理模型）→ 每请求抛 `UNSUPPORTED_REASONING_EFFORT`。
- **版本差异确认**：
  - dsh rc.6（老）：llm-deepseek `REASONING_EFFORTS = [Off, High, Max]`，serialize 拒绝 `low`（`226600147e` 引入 low 之前）。
  - dsh rc.7+（新）：原生支持 `off/low/high/max`。
  - 当前 profile 为 0.1.1-rc.2（新版本）。
- **修复**：
  1. **模型能力守卫**：`agent/request` 拦截器调 `ctx.llm.resolveModelInfo`（按 `provider/model` 缓存，`llm/adapters-updated` 清缓存）检测 `reasoning.efforts`；非推理模型**剥离** `reasoningEffort`（继承的也删），绝不下发。
  2. **手动档位原样透传**：`low` 在 rc.7+ 是原生级别，拦截器不再重写；`resolveEffortInjection` 纯函数承载"剥离/透传/调度"决策。
  3. **rc.6 low 显示与透传**：`advertiseModelCapability` 包装 adapter.resolveModel——efforts 无 `low` 且配置 `models["provider/model"].efforts` 确认含 `low` 时注入 `{ id: 'low' }`（选择器显示 Low + `resolveCallFor` 校验放行 + 透传）。rc.7+ 已有 low 则不注入。
  4. **auto 调度保留 low 候选**：支持 low 的模型 auto 最低可到 low；不支持的模型由能力守卫整体剥离，天然不误传。
  5. **配置**：新增 `models` 节（`provider/model` → `vision` / `thinking` / `efforts` 手动确认，自动检测给推荐值）。
- **Qwen 落地路径（llm-pi-ai 侧，非插件代码）**：
  - Qwen3.6（非 effort 思考模型）：`thinkingFormat: qwen` + `thinkingBudgets` + `reasoningEfforts` → wire 走 `enable_thinking` + budget（对应官方 `extra_body={"enable_thinking": true, "thinking_budget": N}`），不发 reasoning_effort。
  - Qwen3.8-27B（effort 模型）：`reasoningEfforts` 声明档位 + `thinkingFormat: qwen-chat-template` → 透传 effort + `chat_template_kwargs.enable_thinking`。
- **验证**：`tsc --noEmit` 通过；vitest 28 例全过（新增 reasoningEffortSupported / resolveEffortInjection / models 配置测试）。

---

## v0.5.1 — 插件设置卡片：模型能力可选项（不改官方包）

- **需求（用户）**：自定义 API（llm-pi-ai / openai-completions）配置处应能显示"是否视觉 / 是否思考 / 是否支持 think effort"可选项。官方 `ui-settings-models` 的模型目录面板不暴露这些字段，且官方包不允许改动。
- **方案**：不改任何官方包。dsh-thinking-levels 的设置卡片新增"模型能力"区：
  - client 通过 `settingsScope.bind({ namespace: 'llm-pi-ai' })` **直接读写 llm-pi-ai 的 settings namespace**（settings 服务的 `mutate` 不校验调用者是否 owner，RPC 亦放行）。
  - 每个 provider/model 提供：视觉 checkbox（写 `input`）、思考三态 select（写 `reasoningEfforts`：false / 档位表 / 删除继承）、effort 档位多选（off/low/high/max → 同名 wire，off → null）、thinkingFormat 下拉（openai/deepseek/…/qwen/qwen-chat-template/…）。
  - 写回走 `scope.set('providers', 修改后的 user 层 providers)`；llm-pi-ai 自己的 schema + `assertServiceable` 校验每个写，非法值被拒（settings-rejected），不会弄坏配置。
- **配套（上游能力）**：llm-pi-ai 的 `compat.thinkingFormat` 原 withheld `qwen-chat-template`（Qwen3.8 需要 `chat_template_kwargs.enable_thinking`）。已确认 pi-ai 对 `qwen-chat-template` 自行填充 enable_thinking/preserve_thinking，无需额外 kwargs 字段；`chat-template` 需要配置传入 chatTemplateKwargs（llm-pi-ai schema 无此字段）故仍 withheld。**注意**：放开 qwen-chat-template 需改 llm-pi-ai 官方 `catalog.ts`（用户拒绝改官方包，故本版 UI 仍列出该格式，配置是否接受取决于运行环境的 llm-pi-ai 版本）。
- **验证**：typecheck 通过；vitest 28 例全过；client bundle 重建（8.4kB → 23kB）。

---

## 修复版本时间线

| 版本 | 修复内容 |
|---|---|
| v0.1.1 | Node 22 type-stripping：编译产物发布（lib/） |
| v0.2.1 | `exports["./client"]` client 发现 |
| v0.3.0 | 模型选择器 Auto（mask）：adapter efforts 注入 + `prepend` 拦截 |
| v0.4.0 | 去 dsh-settings 值依赖（cordis 服务注入）+ id/key 双环境兼容 |
| v0.4.1 | adapter 包装响应式（`llm/adapters-updated`） |
| v0.5.0 | 模型能力感知：非推理模型剥离 effort（不传不支持字段）；rc.6 注入显示 low + 透传；rc.7+ 不改 low；新增 models 配置节 |

## 通用排查线索

- 插件"已停用/未挂载"无错误：检查 profile 与 `$DSH_HOME/cordis.patch.yml` 的 `disabled` 条目（桌面端可能改写 profile patch 文件）；检查 host 值依赖是否在 profile 解析树内。
- client 入口不在 `__DSH_BOOT__`：确认 `exports["./client"]`、host fiber 已建立、无 disabled。
- 模型选择器档位缺失：确认 adapter `resolveModel` 包装已生效（含事件驱动的补包装）。
- 浏览器静态资源缓存：升级后硬刷新（Ctrl+Shift+R）避免旧 client.js。
