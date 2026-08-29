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
