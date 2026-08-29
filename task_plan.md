# task_plan.md — dsh-thinking-levels 对标 dsh-thinking-effort

## Goal
让 dsh-thinking-levels 在三个维度对标 dsh-thinking-effort：
1. **Effort 档位体系**：off/on/minimal/low/medium/high/xhigh/max（8 档 + auto 哨兵）+ 自定义传输字段映射（wire 值）
2. **画面渲染**：保持 settings.plugin.item 卡片形态，能力编辑器借鉴 effort 的展示元素/样式（供应商分组、图标徽标、档位网格+wire 输入、一键预设、搜索、恢复默认）
3. **多语言**：全套四语 —— locales zh/en/ja/ko + README.{md,zh,ja,ko} + INSTALL.{md,zh,ja,ko} + CHANGELOG.{md,ja,ko}（effort 同款）

## 参考项目
- 对标目标：`E:\test\rewrite-agently\dsh-thinking-effort`（host.mjs + client.js + locales 四语 + 文档四语）
- 被改造项目：`E:\test\rewrite-agently\dsh-thinking-levels`（TS；src/index.ts + thinking-level.ts + client/card.tsx + takeover-sync.ts）

## 用户确认的决策
- 渲染形态：**不新增 settings.section 独立页**，保持 plugins 内部卡片；仅学习思考级别配置的展示方式/元素/样式。
- 多语言范围：**全套四语**（README+INSTALL+CHANGELOG × en/zh/ja/ko + locales 四语）。

## Phases
- [x] **Phase 1 调研**：读 effort 的 host.mjs/client.js/locales/README；读 levels 现有实现；差距清单已写入 findings.md
- [x] **Phase 2 档位体系**：thinking-level.ts 扩展 EffortId（+on/minimal/medium/xhigh）、clampToEfforts 的 on→high 映射；index.ts schema/注入同步；测试 46/46 通过
- [x] **Phase 3 画面渲染**：card.tsx 能力编辑器改为 effort 风格（供应商分组折叠、模型行徽标、档位 grid 开关+wire 输入、一键预设、搜索、恢复默认）；locales 补新 key（zh/en/ja/ko 68 key）
- [x] **Phase 4 多语言**：README.{md,zh,ja,ko} + INSTALL.{md,zh,ja,ko} + CHANGELOG.{md,ja,ko} + 语言切换链接；package.json version 0.6.0 + files 更新
- [x] **Phase 5 验证**：lint/typecheck/build 全过；vitest 46/46；已提交 `d55960e`

## Decisions
- EffortId = 'off' | 'on' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'auto'
- AutoEffort（调度器可选）保持 low/high/max 显式类型，调度逻辑不变
- on 语义：**只传 thinking enable（enable_thinking true），不传 think effort**（用户确认）——注入层 clamp 到 high，由 thinkingFormat 序列化
- **pi-ai reasoningEfforts 表键空间固定 7 档（无 on）**：能力编辑器档位网格用 7 档（与 effort ALL_LEVELS 一致）；on 仅存在于选择器/注入层
- toggle 模型（Qwen3.6）防误标：applyDraft 仅原值 true 或勾选扩展档位时置 supportsReasoningEffort；preset 不动 compat
- medium/xhigh 对 deepseek 官方模型经 clamp 折叠到 high（README 已有该事实）
- 自定义传输映射：reasoningEfforts 表 {level: wire}，UI 每档 wire 输入框（off 留空=null 不发送）
- 卡片内样式保持 CSS 变量（与插件页协调），布局/元素/交互学 effort

## Errors
| Error | Attempt | Resolution |
|-------|---------|------------|
| effortLevelsOf 未使用 lint | 1 | 删除（重构后无引用） |
| `_N` 未使用参数 lint（历史遗留） | 1 | 行内 eslint-disable（泛型约束必需） |
| applyDraft/preset 误标 toggle 模型为 effort | 1 | 仅原值 true 或勾选扩展档位才置 supportsReasoningEffort；preset 不动 compat |
| pi-ai schema 拒绝 on 表键 | 1 | 编辑器网格退回 7 档（effort ALL_LEVELS 同款），on 只留注入层 |
