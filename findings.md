# findings.md — dsh-thinking-levels 对标 dsh-thinking-effort 调研

## 参考项目结构（dsh-thinking-effort）
- `src/host.mjs`（宿主）：DEFAULT_LEVELS = `{off:null, high:'high', max:'max'}`；standard = `['off','minimal','low','medium','high','xhigh','max']`；子 agent 默认档位存 `llm-pi-ai` user 层顶层键 `subagentEffort`；`agent/request` waterfall（global）只对未显式指定档位的子 agent 请求补全。
- `src/client.js`（浏览器，手写 bundle 零构建）：注册 `settings.section` 独立设置页（id `thinking-effort`，order 12）——不是插件卡片。
- `src/locales/{zh,en,ja,ko}.json`：四语字典（pageTitle、subagentCardTitle、presetOfficial/Generic、levelOff~levelMax、wirePlaceholder 等 88 key）。
- 文档：README.{md,zh,ja,ko} + INSTALL.{md,zh,ja,ko} + CHANGELOG.{md,ja,ko}，每语首页顶部有语言切换链接。

## 差距分析

### 1. Effort 档位体系
| 维度 | effort（目标） | levels（现状） |
|---|---|---|
| 标准档位 | 7：off/minimal/low/medium/high/xhigh/max | 5：off/low/high/max/auto（auto 为调度哨兵） |
| 用户要求 | off/on/minimal/low/medium/high/xhigh/max（8 档含 on） | 缺 on/minimal/medium/xhigh |
| 传输映射 | 每档勾选 + 自由填线上值（wire），off 留空=不发送；存 reasoningEfforts {level: wire} | effortTableOf 固定 level→level（off→null），UI 无 wire 输入框 |
| 预设 | official（off/high/max）、generic（off/low/medium/high）一键应用 | 无 |
| 子 agent 默认档位 | 有（subagentEffort） | 无 |
| 搜索 | 有（按模型名/ID） | 无 |

- `on` 是 levels 场景新增语义：toggle 模型（Qwen3.6 类）的"开启思考"档位（effort 无 on）。传输映射：on→toggle 模型的 enable_thinking true（或表内最高 thinking 档位 wire）。
- auto 哨兵必须保留（levels 核心价值：按工具历史调度）。

### 2. 画面渲染
| 维度 | effort | levels |
|---|---|---|
| 形态 | settings.section 独立页（order 12） | settings.plugin.item 折叠卡片 |
| 调色板 | iOS 风格（iosPalette：深/浅自动检测，canvas/group/raised/field/accent） | CSS 变量 var(--dsw-alias-*) |
| 结构 | 供应商分组折叠 → 模型行（图标+能力徽标 text/image/context）→ 展开编辑面板 | 平面列表：每模型一个 <div> |
| 控件 | iosSwitch、图标按钮、搜索框、语言选择器、版本角标、一键预设、恢复默认/危险按钮 | 原生 checkbox + select |
| 编辑面板 | 档位网格（44px 开关 + 58px 档位名 + wire 输入框） | 勾选 checkbox + thinkingFormat select |

### 3. 多语言
| 维度 | effort | levels |
|---|---|---|
| locales | zh/en/ja/ko（88 key） | zh/en（64 key，ja/ko 缺失） |
| README | en/zh/ja/ko + 语言链接 | en/zh |
| INSTALL | en/zh/ja/ko | 无 |
| CHANGELOG | en/ja/ko | BUGFIX-LOG.md（中文，未分语） |

## 关键设计决策（待确认）
1. **渲染形态**：a) 保持 settings.plugin.item 卡片，卡片内借鉴 effort 视觉（分组/搜索/预设/wire 输入）；b) 新增 settings.section 独立页（effort 同款），卡片保留精简版；c) 两者都做。
2. **多语言范围**：a) 仅 README.ja/ko（+locales ja/ko）；b) 全套 README+INSTALL+CHANGELOG 四语（effort 同款）。
3. **档位集**：8 标准档 + auto 哨兵（off/on/minimal/low/medium/high/xhigh/max/auto）；on 仅 toggle 模型显示；wire 映射沿用 llm-pi-ai reasoningEfforts 表。

## 已掌握的实现要点（effort client.js）
- ALL_LEVELS 每档 draft cell = { on: bool, wire: string }；buildLevels 重建 {level: wire}（off 留空→null）。
- setOps 按路由整体替换 models/modelOverrides（settings.mutate path 不支持数组下标）。
- inventoryFrom 从 describe 读 providers.models + modelOverrides 构建清单（含 index/inOverrides 标记）。
- 语言选择器：locale.getSnapshot().active / setLocale；LOCALE_NS = 'settings.thinkingEffort'。
- 版本角标：绝对定位右下角 'v' + PLUGIN_VERSION。

---

# findings.md — 2026-09-06 check 分支:官方 compat 路径替代插件边路

## 关键事实(源码核实,deepseek-harness 逐 tag)
- `compat.supportsDeveloperRole` 首现于 **dsh-v0.1.0-rc.8**(提交 884f7b9c41,
  2026-08-18);rc.7 无。执行点在 pi-ai 上游,DSH 侧 `dsh-llm-pi-ai`
  config.ts:249 `PiAiCompatProfile` 只声明 schema 并透传。
- `THINKING_FORMAT_GATE`(catalog.ts)rc.8 起即含 qwen / qwen-chat-template /
  deepseek 等 10-11 种 → 插件适配器声明的两种 qwen 变体官方全覆盖;
  qwen-chat-template 的 kwargs 经 `compat.chatTemplateKwargs` 声明
  (catalog.ts:377,仅在对应 thinkingFormat 下被读取)。
- `reasoningEfforts` 官方表:键=菜单档位,值=线上词汇(high→ultra),
  off 留空不发送;`thinkingFormat: deepseek` 时 off 发送
  `thinking:{type:disabled}`。
- 文档:docs/user/guide/providers.zh.md L155-160(示例)、L184-185(排错,
  与 #5008 逐字对应)。#3789 默认值反转截至 v0.1.3-alpha.1 未落地 →
  `false` 必须显式写;compat 键冒号留空被拒绝。

## 架构结论
- "用设置 flag 的逻辑替代接管短路开关的保存逻辑"是**伪需求**:
  `supportsDeveloperRole: false` 是 settings.yaml 声明,无需插件代码;
  takeover 短路保存链路(takeover-sync → `llm-openai-completions.enabled`/
  `providers` 命名空间)随插件卸载自然失效,是配置替代而非代码替代。

## dsh-llm-openai-completions 五项职责对照
1. system 角色固定 `system` → 官方 `supportsDeveloperRole:false` 覆盖 ✅
2. thinkingFormat qwen / qwen-chat-template / effort 透传 → 官方 compat 覆盖 ✅
3. reasoningEfforts 词汇映射 → 官方覆盖 ✅
4. Qwen3 内联 `<think>` 拆分 reasoning block(vLLM 无 reasoning_content 字段)→
   **待实测**(缺口候选;catalog 有 `requiresThinkingAsText`、
   `requiresReasoningContentOnAssistantMessages` 待验证语义)
5. 视觉图片 data URI 序列化(多图保序)→ pi-ai 原生 image_url,声明
   `input:[text,image]` 后**待实测**

## 风险
- 4/5 不通过时:dsh-llm-openai-completions 保留对应短板职责,其余卸载;
  数据(record-proxy 的 requests.jsonl)回贴 #5008/#3789。

---

# findings.md — 2026-09-06 补充:hytime/dsh-thinking-effort 的 compat 能力与存储域

## 结论
- 它"先于我们"提供的只是**控制面 UI**:15 个 `llm-pi-ai.compat` 标量字段的
  可视化编辑器(含 `supportsDeveloperRole`,boolean 三态 自动/支持/不支持),
  底层修复仍是 dsh v0.1.0-rc.8 的官方 compat 面(884f7b9c41),并非它自己实现。
- 版本门槛(README.zh.md L22):rc.7 无网关兼容设置;rc.8 ≤ v < 0.1.2-alpha.1
  支持大部分字段但缺 `supportsFinishReason`/`supportsThinkingTokenBudget`;
  0.1.2-alpha.1+ 在 schema 暴露时全 15 个。字段可见性还需运行时 schema +
  路由 `api` 协议双重满足(openai-completions 全 15;openai-responses 系仅 3)。

## 存储域(关键澄清)
- compat 值**不存在它自己的域**,而是经 settings.mutate(新版 remote.settings /
  旧版 connection.api.settings)**写入官方 `llm-pi-ai` 命名空间**:
  - provider 级:`providers.<route>.compat`(该路由全局默认)
  - catalog/modelOverrides 模型:`modelOverrides.<model>.compat` 字段级 set/unset
  - models[] 模型:整条 `providers.<route>.models` 数组 set 回写
  - 取值继承链:model → provider → base/catalog → protocol;Auto = 删除本层字段
- 它自己的域只存 effort 默认值(`subagentEffort` 等)与设置页状态。
- `TAKEOVER_NAMESPACE = 'llm-openai-completions'` 仅为对 dsh-llm-openai-completions
  transport 的**只读互操作探测**(takeover.ts),README L194 明确声明:
  "这些 compat 值属于控制面配置。它们不实现或替代网关 transport;
  网络请求仍由外部 transport 负责"。

## 对 check 分支计划的影响
- 官方路径 B 的配置可由 dsh-thinking-effort UI 写入(等价于手写 yaml),
  但 Qwen3 `<think>` 拆分 / 视觉序列化两个数据面缺口候选不受它影响——
  它不替代 transport,checklist 的 4/5 两项判据保持不变。
