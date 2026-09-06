# Checklist — 2026-09-06 check 分支:官方 compat 路径验证

## Must Pass(判定 dsh-llm-openai-completions 可否卸载)
- [ ] record-proxy 汇总:developer 角色出现请求数 = 0,网关无
      `Unexpected message role` 400
- [ ] `thinkingFormat: qwen`(或 qwen-chat-template + chatTemplateKwargs)下,
      off/开档位发送 `enable_thinking` 形状正确(代理逐条核对)
- [ ] `reasoningEfforts` 映射生效:选 High 收到映射值(如 ultra),off 无 effort
- [ ] 多步工具链每轮请求形状一致(与插件基线 A 对拍)
- [ ] 缺口候选 1:Qwen3 内联 `<think>` 拆分——thinking 文本不混入正文,
      reasoning block 正常渲染(不通过则 dsh-llm-openai-completions 保留)
- [ ] 缺口候选 2:视觉模型多图输入按序到达网关(不通过则保留插件)

## Should Pass
- [ ] 会话内模型选择器档位菜单与插件时代体验等价
- [ ] 验证后 requests.jsonl 归档并回贴 #5008/#3789
