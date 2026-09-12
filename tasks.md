# Tasks — DSH 0.1.5-rc 升级兼容（compat/0.1.5 分支）

## Phase 1: 分支与依赖
- [ ] task_1: `git checkout -b compat/0.1.5 master`（确认工作树干净）
- [ ] task_2: package.json devDeps 五个 `@deepseek-ai/dsh-client-*` → `0.1.5-rc.2`（精确版本，不用 ^）；`npm install`
- [ ] task_3: `npm run typecheck` 记录全部类型漂移清单（预期集中在 slots 契约）

## Phase 2: settings 卡片槽位迁移（src/client/index.ts）
- [ ] task_4: 验证回退方式——在 0.1.5-rc.2 类型下确认 `ctx.slots.register` 对未声明槽的行为（读 dsh-client-ui-slots dist js 的 register 路径）；确定「双注册静默容忍」或「try/catch 回退」
- [ ] task_5: 新增 `settings.plugins.tab` 注册分支：options `{ name: 'settings.plugins.tab', id: THINKING_LEVELS_NS, order: 100, label, locale: NS, inject }`，`label` 用 `() => ctx.locale.t(NS, 'cardTitle')` 形式的本地化工厂（与 card.tsx 现有 title key 对齐）；inject 工厂复用现有 `{ scope, piAiScope }`
- [ ] task_6: 保留 `settings.plugin.item` 回退注册（现有代码不动或按 task_4 结论包 try/catch）
- [ ] task_7: locale 切换重注册：若 label 为工厂函数仍不刷新（见 ui-settings 注释要求 registrant 重注册），监听 locale 变更事件 dispose + 重新注册 tab

## Phase 3: 修复与验证
- [ ] task_8: 修复 task_3 暴露的其余类型漂移（预期候选：`settings/document-updated` 回调签名、slots 类型参数）；不改宿主半逻辑
- [ ] task_9: `npm run lint && npm run test && npm run build` 全绿
- [ ] task_10: 版本号 → 2.0.0-beta.3（package.json + dsh.plugin.json + CHANGELOG.md/zh/ja/ko 追加条目）

## Phase 4: 文档与收尾
- [ ] task_11: README/README.zh（+ja/ko）版本矩阵加 0.1.5 行；排障章节加「升级后卡片不显示 → 强制刷新浏览器」
- [ ] task_12: 提交 compat/0.1.5 分支（feat: DSH 0.1.5-rc compat — settings.plugins.tab seat + devDeps 0.1.5-rc.2）
- [ ] task_13: 实机验收过 checklist.md「Must Pass」各项（0.1.5-rc.2 + 0.1.2-rc.1 回退）
