# Tasks — 2026-09-06 check 分支:官方 compat 路径验证

## Phase 1: 材料补齐(check 分支,均 ≤5 分钟)
- [ ] task_1: 更新 check/settings-route.example.yaml——加入
      `thinkingFormat: qwen` 与 `chatTemplateKwargs: { enable_thinking: "true" }`
      注释示例(qwen-chat-template 变体),标注 rc.8 起可用
- [ ] task_2: record-proxy.mjs 增加 `<think>` 内联检测:assistant content 含
      `<think>` 标签时在汇总中单独计数(缺口候选 1 的证据)
- [ ] task_3: CHECK.md 增补"五项职责对照表"与 4/5 两缺口判据

## Phase 2: A/B 实测(人工,dsh ≥ v0.1.0-rc.8)
- [ ] task_4: 起代理,基线 A(插件接管)跑一轮多步推理会话,存 requests.jsonl
- [ ] task_5: 卸两插件(`dsh plugin --profile <p> remove ... -w`),套用模板 B
      重跑同一轮,developer=0、effort 映射、enable_thinking 形状核对
- [ ] task_6: 缺口验证——Qwen3 `<think>` 拆分;视觉模型多图按序
- [ ] task_7: 按 checklist 判定;不通过项 → 恢复对应插件职责;通过 →
      官方路径定稿,数据回贴 #5008/#3789

## 交付物
- check/requests.jsonl(A/B 两份)、CHECK.md 勾选结果、卸载/保留结论
