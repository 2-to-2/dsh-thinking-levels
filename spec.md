# Spec: dsh-thinking-levels DSH 0.1.5-rc 升级兼容（compat/0.1.5 分支）

> 2026-09-06 的 check 分支任务已完成，旧产物见 git 历史（ecfa7db 等）。

## 需求
- 在 `compat/0.1.5` 分支上使插件兼容 DSH 0.1.5-rc.1 / rc.2。
- 分支内保留对 ≤0.1.3 的回退（不破坏 master 0.1.2+ 兼容线）。
- 产出可发布版本 2.0.0-beta.3 + README 版本矩阵更新。

## 现状（已核实）
- 当前在 `master`（2.0.0-beta.2），无 `compat/0.1.5` 分支，需从 master 新建。
- devDeps 锁在 `^0.1.0-rc.7`；peerDeps / engines.dsh 已是 `>=0.1.2-alpha.1 <0.2.0-0`，天然覆盖 0.1.5-rc.2。
- npm 上 `@deepseek-ai/*@0.1.5-rc.2` 已发布。

## 0.1.5-rc.2 契约探针结论（临时目录解包 .d.ts 核实）
| 扩展点 | 0.1.5-rc.2 现状 | 影响 |
|---|---|---|
| `settings.plugin.item` 槽 | **已移除**（ui-settings 全包无声明） | 🔴 settings 卡片必须迁移 |
| `settings.plugins.tab` 槽 | 新增：list，options `id`/`order`/`label`（`SlotLabel = string \| (() => string)`），owner 不传 props | 卡片改挂此槽；`inject` 工厂仍受支持，`{scope, piAiScope}` 注入可保留 |
| `conversation.input.right` 槽 | ✅ 仍存在（list / session） | context-quick 注册不变 |
| `settings.register(ns, schema, {base})` | ✅ 保留（另有新 `installSection`） | 宿主半无需改 |
| `settings.get(ns)` / `update(ns, patch)` | ✅ 保留（`update` 新增可选 `expectedRevision`） | takeover-sync 无需改 |
| `settings/document-updated` | ✅ 保留，签名 `(ns, revision)` | 现有监听兼容 |
| `locale.register` 双 overload | ✅ 保留 | 无需改 |
| `settingsScope.bind({namespace})` | ✅ 保留 | 无需改 |
| `agent/request` / `session.events tool/call` | 核心 API，以 0.1.5-rc.2 devDeps 下 typecheck + vitest 验证 | 待验证任务 |

## 技术方案
1. **settings 卡片双槽位回退**（`src/client/index.ts`）：0.1.5+ 挂 `settings.plugins.tab`（`id` + `order` + `label`，inject 返回原 `{scope, piAiScope}`）；≤0.1.3 回退 `settings.plugin.item`（现有 id/key 双写不变）。回退判定用运行时探测（详见 findings §回退探测）。卡片组件 `card.tsx` 不改——只消费注入 scope。
2. **依赖升级**：devDeps 五个 `@deepseek-ai/*` → `0.1.5-rc.2`，typecheck 暴露剩余类型漂移并修复。
3. **元数据**：engines / peerDeps 维持现值；版本号 → `2.0.0-beta.3`（package.json + dsh.plugin.json 同步）。
4. **README**：版本兼容矩阵加 0.1.5 行；排障章节加「升级后插件卡片不显示 → 强制刷新浏览器（client combo 缓存陈旧）」。

## 决策记录
| 选项 | 选择 | 理由 |
|---|---|---|
| 槽位迁移策略 | 双槽位运行时回退 | compat 分支与 master 同源演进，0.1.2 用户不丢卡片；与现有 id/key 双写同模式 |
| settings API | 维持 `register`，不迁 `installSection` | register 在 0.1.5-rc.2 仍保留，迁移无收益（YAGNI） |
| devDeps 版本 | 直接升 0.1.5-rc.2 | compat 分支目标即 0.1.5，类型检查以最新 rc 为准 |

## 约束
- 宿主半不得 value-import `@deepseek-ai/dsh-settings`（既有约定，保持）。
- 客户端 bundle 保持纯 type-only import（既有约定）。
