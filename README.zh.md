# dsh-thinking-levels

**为 [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness) 提供按轮次的思考档位（`reasoning_effort`）控制：在会话模型选择器中可选 `Auto`（mask）——由插件按工具调用历史自动在 `low` / `high` / `max` 间调度后提交 API；也可手动固定 `off` / `on` / `minimal` / `low` / `medium` / `high` / `xhigh` / `max`，让廉价工具轮次保持廉价，同时绝不让重任务缺少推理。**

- [English README](./README.md)
- [中文 README](./README.zh.md)
- [日本語 README](./README.ja.md)
- [한국어 README](./README.ko.md)
- [安装指南](./INSTALL.zh.md)
- [English installation guide](./INSTALL.md)
- [日本語インストールガイド](./INSTALL.ja.md)
- [한국어 설치 안내](./INSTALL.ko.md)
- [版本更新日志](./CHANGELOG.md)
- [日本語 changelog](./CHANGELOG.ja.md)
- [한국어 changelog](./CHANGELOG.ko.md)

> **兼容性说明：** `0.6.0` 已包含日本語（`ja`）和한국어（`ko`）字典及选择项，但当前官方 DSH 只通过 `LocaleRuntime` 提供 `zh` 和 `en`。在原版 DSH 中选择 `ja` 或 `ko` 会失败，并提示 `locale "<id>" is not registered`。需要等待官方 DSH 增加对应 locale ID 后才能正常使用。高级用户可以维护 DSH fork，在 `packages/client/locale/src/locale-settings.ts` 更新 `LOCALE_IDS`，在 `packages/client/locale/src/client/index.ts` 更新 `LOCALES` 标签，并补齐核心字典和测试，然后重新构建并运行 fork 版本。仅修改本插件无法扩展 DSH 的全局 locale 列表。

在多步工具链任务中，模型在**每一次工具调用前**都会重新思考——而这个思考过程占据了绝大部分墙钟时间（一个 50 步的 agent 任务可能在工具之间花费数分钟思考）。`dsh-thinking-levels` 接入 dsh 每一步都会重新解析的 `agent/request` waterfall（以 `prepend` 置于最外层，避免被会话模型选择覆盖），向下一次模型请求注入思考档位。

## 档位

| 档位 | 含义 | 位置 |
|---|---|---|
| `off` | 关闭思考（仅手动选择，自动调度永不选用） | 模型选择器 / 默认档位 |
| `on` | 开启思考，使用模型默认强度（如 `high`）；toggle 型模型的 On/Off 开关 | 模型选择器 / 默认档位 |
| `minimal` | 最低档（极轻任务） | 模型选择器 / 默认档位 |
| `low` | 手动低档，对应简单对话任务（廉价轮次保持廉价） | 模型选择器 / 默认档位 |
| `medium` | 中档 | 模型选择器 / 默认档位 |
| `high` | 官方默认档位 | 模型选择器 / 默认档位 |
| `xhigh` | 特高档 | 模型选择器 / 默认档位 |
| `max` | 重任务 | 模型选择器 / 默认档位 |
| `auto` | **mask**：按最近的工具调用历史逐轮调度，提交 API 前解析为具体档位 | 模型选择器（由插件注入元数据）/ 默认档位 |

线缆档位事实（对照官方 DeepSeek 文档与 dsh `llm-deepseek` 适配器核实）：deepseek-v4-flash / v4-pro 上 `low` 1:1 生效，`medium` / `xhigh` 折叠到 `high`。适配器只接受 `off | low | high | max`，其他值抛 `UNSUPPORTED_REASONING_EFFORT`——`auto` 是插件的 mask 层，永不直接发送给 API，注入前必然解析为具体线缆档位。

## 自定义传输字段映射

对 `llm-pi-ai` 手工声明的模型，设置卡片可以把每个档位映射为你网关真正接受的值（借鉴 dsh-thinking-effort）：勾选档位并填写线上值，例如 `high` → `ultra`。映射存为该模型的 `reasoningEfforts` 表——Composer 选中 `High` 时，网关实际收到 `ultra`。`off` 留空表示不发送。

- 官方预设：`Off / High / Max`（官方 DeepSeek 风格）
- 通用预设：`Off / Low / Medium / High`

## 模型能力守卫（v0.5.0）

插件**绝不向未声明推理能力的模型发送 `reasoning_effort`**。自定义 openai-completions 路由（如未配置 `reasoningEfforts` 的本地 Qwen3.6）通过 `ctx.llm.resolveModelInfo` 被判定为非推理模型，任何档位（继承的或调度产生的）都会被**剥离**而不是下发——dsh 的逐请求 `UNSUPPORTED_REASONING_EFFORT` 拒绝因此不会触发。不支持的字段绝不打进 API。

版本行为：

| dsh 版本 | `low` 处理 |
|---|---|
| rc.6（老） | 非原生：仅当配置 `models` 覆盖确认该档位时选择器才显示；注入展示（选择器 + 请求校验放行）后原样透传 |
| rc.7+（新） | 原生：插件既不重写也不重复注入；手动选 `low` 原样透传 |

auto 调度对支持的模型仍可选出 `low`——由上面的能力守卫负责让它远离不能接收它的模型。

## 模型选择器 Auto

会话界面模型选择器（模型旁）现在提供 **Auto** 档位（由插件注入模型目录元数据，位于线缆档位之后）：

| 模型选择器选择 | 行为 |
|---|---|
| **Auto** | 插件按工具调用历史 + 升降档开关调度，解析成 `low` / `high` / `max` 后提交 API |
| `off` / `on` / `minimal` / `low` / `medium` / `high` / `xhigh` / `max` | **尊重手动选择**，插件不介入（`on` 会被钳制到模型默认强度） |
| 未选择 | 使用插件的默认档位（见下） |

## 自动调度

中枢为 `high`（官方默认）。`auto` 只在 `low` / `high` / `max` 之间调度；永不选 `off`。

| 最近的工具调用 | 档位 |
|---|---|
| 无（全新提示，纯对话） | `low` |
| ≥75% 简单工具、小载荷、允许降档 | `low` |
| 混合 / 重工具 | `high` |
| 超大载荷、允许升级 | `max` |

调度策略与 [dsh-tool-turbo](https://github.com/drscrewdriver/dsh-tool-turbo) 同源（同一套简单工具白名单 / 载荷阈值 / 75% 比例规则）。

## 安装

完整流程（profile 确认、升级、迁移、验证、排查）见 [INSTALL.zh.md](./INSTALL.zh.md)。快速开始：

```bash
# 1. 从 npm 把插件装进某个 profile（以 web 为例，任意 profile 均可）
#    （web profile 是 pnpm workspace root，必须带 -w）
dsh plugin --profile web add dsh-thinking-levels -w
#    GitHub 安装备选：
#    dsh plugin --profile web add https://github.com/drscrewdriver/dsh-thinking-levels.git -w
#    本地路径备选（无需网络）：
#    dsh plugin --profile web add /dsh-thinking-levels 的绝对路径/

# 2. 重启 dsh web（运行中的实例不会热加载新的 bundle 层）
dsh web
```

> 注意：dsh 运行环境使用 pnpm 11，新发布的版本会受 `minimumReleaseAge` 冷却期约束；如安装报
> `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`，在 `~/.dsh/profiles/web/pnpm-workspace.yaml` 的
> `minimumReleaseAgeExclude` 中加入对应版本即可。

手动 `link:` 注册（`dsh plugin add` 的备选方式）：

```bash
#    ~/.dsh/profiles/web/package.json dependencies 增加：
#      "dsh-thinking-levels": "link:<dsh-thinking-levels 的绝对路径>"
#    ~/.dsh/profiles/web/cordis.patch.yml：
#      - insert:
#          - id: thinking-levels
#            name: dsh-thinking-levels
cd ~/.dsh/profiles/web && pnpm install && dsh web
```

## 配置

两个配置面共用同一套 schema：

- **装配层** — profile 组合中插件行的 `config:`（如 `cordis.yml`）：
  ```yaml
  config:
    level: auto            # off | on | minimal | low | medium | high | xhigh | max | auto —— 会话未显式选择时的默认档位
    allowDowngrade: true   # 允许调度器降到 `high` 以下
    allowUpgrade: false    # 禁止调度器升到 `max`
  ```
- **运行时** — dsh-settings 命名空间 `thinking-levels`（`level`、`allowDowngrade`、`allowUpgrade`、`enabled`、`models`）：改动对下一次模型请求生效，无需重启。设置面板（设置 → 插件 → 可配置插件）提供可视化编辑（档位网格 + 线上值输入 + 搜索 + 一键预设）。

按模型的 `models` 覆盖（键为 `provider/model`）用于确认自动检测结果，配置者拥有最终决定权：

```yaml
config:
  level: auto
  models:
    llm-pi-ai/Qwen3.6-35B-A3B:   # 非 effort 思考模型（思考开关 + budget）
      vision: false
      thinking: true
      efforts: false             # 永不发送 reasoning_effort（请求时剥离）
    llm-pi-ai/Qwen3.8-27B:       # effort 模型（rc.6 时代适配器没有 low）
      efforts: [low, high]       # 确认 low → 选择器展示 + 透传
```

> 对 Qwen 思考开关 + budget，请配置 **llm-pi-ai** 路由：
> `compat.thinkingFormat: qwen`（→ 线缆 `enable_thinking` + `thinking_budget`，经
> `thinkingBudgets`），或 `qwen-chat-template`（→ `chat_template_kwargs.enable_thinking`）
> 用于 Qwen3.8-27B 这类 effort 模型。

默认值：`{ enabled: true, level: 'auto', allowDowngrade: true, allowUpgrade: false, models: {} }`。

> 语义说明：模型选择器选择优先于插件默认档位。选 `auto`（mask）→ 插件调度；选线缆档位 → 直接生效；未选择 → 使用插件的 `level` 默认档位。`allowDowngrade` / `allowUpgrade` 只约束 `auto` 调度。

## 与 dsh-llm-openai-completions 自动联动（v0.5.2）

自定义网关（vLLM / LM Studio / 自建 OpenAI 兼容代理）**声明思考功能后**（`llm-pi-ai` 的模型行有 `reasoningEfforts` 表），必须由 [dsh-llm-openai-completions](https://github.com/drscrewdriver/dsh-llm-openai-completions) 接管该路由——否则 pi-ai 会发 `role: "developer"`（400）或漏掉 `enable_thinking`。本插件**自动维护接管名单**：

- 扫描 `llm-pi-ai.providers`，识别「自定义 openai-completions 网关（`api: openai-completions` 或非官方 baseURL）**且** 任一模型声明 `reasoningEfforts` 表」的 provider；
- 自动将其并入 `llm-openai-completions.providers` 并置 `enabled: true`（保留用户已手动添加的名单，去重）；
- 触发时机：插件启动、`llm/adapters-updated`、`llm-pi-ai` 或接管名单的 settings 变化——无需手动改配置；
- 软耦合：`llm-openai-completions` 插件未安装（命名空间未注册）时自动跳过写入，不影响本插件其它功能。

## 依赖说明

插件 host 侧**不**值依赖 `@deepseek-ai/dsh-settings`（设置注册通过 cordis 的 `settings` 服务，由 dsh 运行时提供）——无需在 profile 中手动安装官方包。`dependencies` 仅 `@deepseek-ai/schemastery`（随包自动安装）。

## 开发

```bash
npm run lint        # eslint（typescript-eslint flat config）
npm run typecheck   # tsc --noEmit
npm test            # vitest — 46 个测试
```

测试覆盖：档位策略（手动透传含扩展档位、`on` 钳制、auto 调度、档位校验、简单工具边界）、模型能力守卫（`reasoningEffortSupported`、`resolveEffortInjection` 剥离/透传）、会话事件解析（守卫、窗口截断、畸形记录）、配置 schema（默认值同步、越界拒绝、`models` 覆盖）、接管同步（识别、去重合并、软耦合）。

## 许可

MIT
