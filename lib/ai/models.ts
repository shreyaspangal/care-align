// Model selection is controlled by AI_MODEL_TIER env var.
// development → Haiku (fast, cheap, for local dev + CI)
// production  → Sonnet (accurate, for real documents)
// Never hardcode a model string outside this file (CLAUDE.md rule 3).

const isDev = process.env.AI_MODEL_TIER !== 'production'

export const AI_MODELS = {
  classify: isDev ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-6',
  translate: isDev ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-6',
  summarise: isDev ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-6',
} as const
