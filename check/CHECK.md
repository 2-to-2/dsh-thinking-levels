# check 分支:官方 compat 路径验证(摆脱插件边路)

目的:验证上游 dsh 的声明式 `compat` 配置(v0.1.0-rc.8 起支持,见
deepseek-ai/deepseek-harness#5008 官方回复、#3789、#4937)能否完整替代本插件
存在的两个理由,从而卸载 `dsh-thinking-levels` 与 `dsh-llm-openai-completions` 边路:

1. **developer 角色 400**:模型声明 `reasoningEfforts` 后 pi-ai 把系统提示词以
   `developer` 角色发送,vLLM/SGLang 等网关报
   `400 {"message":"Unexpected message role."}`。
   → 官方修法:路由/模型上声明 `compat.supportsDeveloperRole: false`。
2. **思考档位词汇映射**:网关自有词汇(如 `high → ultra`)、toggle 型模型的
   关闭思考等,插件原来靠设置卡片映射 `reasoningEfforts`。
   → 官方修法:模型上直接声明 `reasoningEfforts` 表 + `compat.thinkingFormat: deepseek`。

> 前置:dsh ≥ **v0.1.0-rc.8**(引入提交 `884f7b9c41`,2026-08-18)。
> 注意 #3789 的默认值反转提案截至 v0.1.3-alpha.1 未落地,`false` 必须显式写出;
> compat 键冒号留空会被直接拒绝(防止抹掉 catalog 已知信息)。

## 职责对照:两条路线互斥互为替代(developer-role 维度)

`dsh-llm-openai-completions` 五项职责 vs 官方声明式配置:

| # | 插件职责 | 官方覆盖 | 结论 |
| --- | --- | --- | --- |
| 1 | system 角色固定 `system`(developer 400 修复) | `compat.supportsDeveloperRole: false` | ✅ 覆盖——互斥替代关系的主判定项 |
| 2 | `thinkingFormat: qwen` / `qwen-chat-template` 接管 | 官方 `THINKING_FORMAT_GATE` rc.8 起全量含 qwen 系;kwargs 走 `compat.chatTemplateKwargs` | ✅ 覆盖 |
| 3 | effort 透传 + 词汇映射(high→ultra) | 模型 `reasoningEfforts` 表 | ✅ 覆盖 |
| 4 | Qwen3 内联 `<think>` 拆分 reasoning block(vLLM 无 reasoning_content 字段) | 未知;catalog 有 `requiresThinkingAsText` 等开关待验证 | ⚠️ 缺口候选 1,代理实测 |
| 5 | 视觉图片 data URI 序列化(多图保序) | pi-ai 原生 image_url + `input:[text,image]` | ⚠️ 缺口候选 2,实测 |

判定逻辑:flag 生效 + 移除短路插件后,请求走 pi-ai 原生链路,代价仅是多声明
一个显式 flag(默认值反转未落地,不能省)。#1-#3 已由源码核实覆盖;**#4/#5
实测通过才可整体卸载插件**,否则插件仅保留对应短板职责。

## 文件

| 文件 | 用途 |
| --- | --- |
| `settings-route.example.yaml` | 官方路径的 settings.yaml 配置模板(无插件) |
| `record-proxy.mjs` | 录制代理:捕获真实请求体,断言 developer 角色与 reasoning_effort |

## 验证步骤

### 0. 起录制代理

```bash
node check/record-proxy.mjs --upstream https://你的网关/v1 --port 8787
```

它监听 `127.0.0.1:8787`,把 dsh 发来的请求原样转发给网关(含 SSE 流式),
同时把每个请求体记到 `check/requests.jsonl` 并实时报告:

- `role: "developer"` 出现次数(**必须为 0**)
- `reasoning_effort` 实际发送值
- 是否出现 `max_tokens`/`max_completion_tokens`

### 1. 基线 A(插件边路,现状)

保持现有插件 + 路由配置,provider 的 `baseURL` 指向 `http://127.0.0.1:8787/v1`,
跑一轮带推理模型的多步会话。预期:请求里出现 `developer` 角色(或网关 400)。
这是插件要修的问题基线。

### 2. 官方路径 B(无插件)

1. `dsh plugin --profile <profile> remove dsh-thinking-levels -w`
   (若装了 `dsh-llm-openai-completions` 一并 remove)
2. 按 `settings-route.example.yaml` 改自定义提供方路由:
   - `compat.supportsDeveloperRole: false`(必需)
   - 模型 `reasoningEfforts` 映射 + 按需 `compat.thinkingFormat: deepseek`
   - provider `baseURL` 仍指向录制代理
3. 重跑同一轮会话(新建会话,避免历史图片/消息残留影响请求形状)。

### 3. 判据(全部满足才算通过)

- [ ] 代理报告 developer 角色次数 = 0,网关无 `Unexpected message role` 400
- [ ] 选 `High` 时线上收到映射值(如 `ultra`);`off` 时无 `reasoning_effort`
      (声明了 `thinkingFormat: deepseek` 的应收到 `thinking: {type: disabled}`)
- [ ] 多步工具链的每一轮请求形状一致(代理里逐条核对)
- [ ] 会话内模型选择器档位菜单正常,与插件时代体验等价

### 4. 收尾

- 通过:保留官方配置;两个插件不再装回(本插件仓库的 master/feat 分支仅存档)。
- 不通过:恢复 master 分支的插件安装方式,并把差异数据
  (`check/requests.jsonl`)贴回 #5008 / #3789。

### 回滚

```bash
git checkout master   # 本仓库
dsh plugin --profile <profile> add dsh-thinking-levels -w
```
settings.yaml 中删除 `compat`/`reasoningEfforts` 覆盖即可回到插件接管。
