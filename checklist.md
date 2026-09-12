# Checklist — DSH 0.1.5-rc 升级兼容（compat/0.1.5）

## Must Pass
- [ ] `npm run typecheck` 在 devDeps=0.1.5-rc.2 下零错误
- [ ] `npm run lint`、`npm run test`（含 session-events 形状护栏测试）全绿
- [ ] `npm run build` 产出 lib 完整（host + client bundle）
- [ ] DSH 0.1.5-rc.2 实机：插件加载成功，设置 → 插件页出现 thinking-levels 标签页，卡片可编辑 level/toggles
- [ ] DSH 0.1.5-rc.2 实机：composer 工具行 context-window 控件渲染且可改 contextWindow
- [ ] DSH 0.1.5-rc.2 实机：auto 调度生效（日志 `[thinking-levels] agent/request: ... => level=`）
- [ ] 回退验证：DSH 0.1.2-rc.1 实机（或 CLI 等价环境）上卡片仍通过 `settings.plugin.item` 渲染
- [ ] llm-pi-ai 官方 compat 同步（supportsDeveloperRole / thinkingFormat）在 0.1.5 实机写入成功且 schema 校验通过

## Should Pass
- [ ] locale 切换 zh↔en 后 tab 标签文本跟随刷新
- [ ] 升级场景冒烟：旧 profile 升 0.1.5 后强制刷新浏览器，卡片出现（client combo 缓存）
- [ ] README 版本矩阵含 0.1.5 行 + 排障条目；四语 README 同步
- [ ] `dsh.plugin.json` / `package.json` 版本号一致（2.0.0-beta.3）
