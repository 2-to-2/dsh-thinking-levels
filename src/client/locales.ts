/** `thinking-levels` client dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'thinking-levels'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'card.title': '思考档位',
  'card.description': '在模型选择器中可选 Auto（mask）：按工具调用历史自动在 low / high / max 间调度后提交 API。此处配置默认档位与调度边界。',
  'card.level': '默认档位',
  'card.level.off': 'off — 关闭思考（仅手动，永不自动选择）',
  'card.level.low': 'low — 低（简单任务，廉价轮保持廉价）',
  'card.level.high': 'high — 高（官方默认）',
  'card.level.max': 'max — 最大（重任务）',
  'card.level.auto': 'auto — 按工具历史自动调度（默认）',
  'card.enabled': '启用',
  'card.allowDowngrade': '允许降档（auto 可降至 low）',
  'card.allowUpgrade': '允许升档（auto 可升至 max）',
  'card.unavailable': '设置命名空间不可用：请确认 dsh-thinking-levels 已装配进 profile。',
  'card.readonly': '只读',
  'card.capabilities': '模型能力（llm-pi-ai 自定义提供方）',
  'card.capabilities.hint': '直接读写 llm-pi-ai 配置：视觉决定图片输入；思考开关决定 enable_thinking 置位；支持 think effort 时才显示档位（off 关闭思考，Qwen3.8 类：max/high/low，medium/xhigh 折叠为 high）；thinkingFormat 决定 wire 序列化格式。',
  'card.capabilities.empty': '未在 llm-pi-ai 配置任何自定义模型。请先在「设置 → 模型」添加提供方与模型。',
  'card.capabilities.unavailable': 'llm-pi-ai 设置命名空间不可用。',
  'card.capabilities.none': '（无模型）',
  'card.capabilities.vision': '视觉模型',
  'card.capabilities.thinking': '思考模型',
  'card.capabilities.supportsEffort': '支持 think effort',
  'card.capabilities.efforts': '思考档位',
  'card.capabilities.thinkingFormat': '思考格式',
  'card.capabilities.thinkingFormat.inherit': '继承',
  'card.capabilities.saved': '已保存',
  'card.capabilities.failed': '保存失败：配置被拒绝或冲突，请检查值。',
} satisfies Record<string, string>

/** English dictionary (keys mirror zh). */
export const en: Record<keyof typeof zh, string> = {
  'card.title': 'Thinking Levels',
  'card.description': 'Pick Auto in the model selector: the plugin schedules low / high / max per tool round before submitting the API effort. Here you configure the default level and scheduler bounds.',
  'card.level': 'Default level',
  'card.level.off': 'off — disable thinking (manual only, never auto-picked)',
  'card.level.low': 'low — cheap rounds stay cheap',
  'card.level.high': 'high — the official default',
  'card.level.max': 'max — heavy work',
  'card.level.auto': 'auto — schedule from tool history (default)',
  'card.enabled': 'Enabled',
  'card.allowDowngrade': 'Allow downgrade (auto may drop to low)',
  'card.allowUpgrade': 'Allow upgrade (auto may lift to max)',
  'card.unavailable': 'Settings namespace unavailable: make sure dsh-thinking-levels is assembled into this profile.',
  'card.readonly': 'Read-only',
  'card.capabilities': 'Model capabilities (llm-pi-ai custom providers)',
  'card.capabilities.hint': 'Reads and writes the llm-pi-ai config directly: vision gates image input; the thinking toggle drives enable_thinking; "supports think effort" reveals the level pickers (off disables thinking; Qwen3.8-style max/high/low, medium/xhigh collapse onto high); thinkingFormat picks the wire serialization.',
  'card.capabilities.empty': 'No custom models are configured in llm-pi-ai. Add a provider and models under Settings → Models first.',
  'card.capabilities.unavailable': 'The llm-pi-ai settings namespace is unavailable.',
  'card.capabilities.none': '(no models)',
  'card.capabilities.vision': 'Vision model',
  'card.capabilities.thinking': 'Thinking model',
  'card.capabilities.supportsEffort': 'Supports think effort',
  'card.capabilities.efforts': 'Thinking effort levels',
  'card.capabilities.thinkingFormat': 'Thinking format',
  'card.capabilities.thinkingFormat.inherit': 'Inherit',
  'card.capabilities.saved': 'Saved',
  'card.capabilities.failed': 'Save failed: the value was rejected or conflicted. Check it.',
}
