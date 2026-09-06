# Spec: check 分支官方 compat 路径替代插件边路

## 需求
- 澄清 `compat.supportsDeveloperRole: false` 的定位:它是 settings.yaml 声明式配置,
  由 dsh-llm-pi-ai(config.ts:249 `PiAiCompatProfile`)读取并透传给 pi-ai 执行,
  **不需要**在 check 分支编写任何"设置该 flag 的逻辑"。
- check 分支的验证目标:用官方声明式配置**配置替代**(而非代码替代)插件接管链路,
  确认 `dsh-llm-openai-completions` 与 `dsh-thinking-levels` 可否卸载。
- 明确 `dsh-llm-openai-completions` 五项职责与官方路径的覆盖对照,识别残留缺口。

## 技术方案
- 不改插件源码。check 分支仅在 check/ 目录维护验证材料(CHECK.md、
  settings-route.example.yaml、record-proxy.mjs)。
- 对照表(官方覆盖 → 结论):
  1. system 角色固定 `system` = `compat.supportsDeveloperRole: false`(rc.8+)→ 覆盖
  2. `thinkingFormat: qwen` / `qwen-chat-template` / `deepseek` 等 11 种
     (catalog.ts THINKING_FORMAT_GATE,rc.8 起全量)→ 覆盖;
     qwen-chat-template 所需 kwargs 由 `compat.chatTemplateKwargs` 声明
  3. effort 透传 + 词汇映射 = 模型 `reasoningEfforts` 表 → 覆盖
  4. Qwen3 内联 `<think>` 拆分为独立 reasoning block → **待实测**(缺口候选)
  5. 视觉图片 data URI 序列化 → pi-ai 原生 `image_url` 支持,声明 `input:[text,image]`
     后**待实测**
- 验证手段:record-proxy.mjs 录制真实请求体(A 插件基线 / B 官方路径对照)。

## 决策记录
| 选项 | 选择 | 理由 |
|------|------|------|
| 在插件里实现 flag 写入逻辑 | 否 | flag 属于 dsh-llm-pi-ai 配置面,插件写入属重复造轮;YAGNI |
| 接管短路开关(takeover 清单)逻辑 | 停用不替代 | 随插件卸载自然失效,配置即声明,无保存逻辑可迁移 |
| dsh-llm-openai-completions 是否卸载 | 待验证 4/5 两项 | 1/2/3 已确认覆盖;4/5 是 README 声称的独有职责 |

## 约束
- dsh ≥ v0.1.0-rc.8(引入 884f7b9c41);thinkingFormat qwen 系 rc.8 起可用。
- #3789 默认值反转未落地:`supportsDeveloperRole: false` 必须显式写。
- compat 键冒号留空被 dsh 拒绝;每键必须给值。
- 验证用 dsh ≥ v0.1.2-rc.1 亦可(pi-ai ^0.84.2,开关集更全)。
