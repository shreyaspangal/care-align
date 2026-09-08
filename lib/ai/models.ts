import 'server-only'

import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

// Hard Rule 12: model strings live ONLY here. Callers ask by role and get the
// tier-appropriate model; swapping a model or tier is a one-line change here.
// Tier is env-driven (AI_MODEL_TIER); anything other than 'production' is dev.
//
// Production is Anthropic on purpose — Output.object on Anthropic is backed by
// real tool calling (confirmed in @ai-sdk/anthropic's source: it forces a JSON
// tool call when native structured output isn't available, so there is no
// unenforced path), meaning a required field cannot silently go missing.
// D-004's 2026-09-08 model sweep put `gpt-5-mini` on the eval slate as a
// genuinely cheaper alternative with the same hard guarantee — that's a
// pre-production decision (eval set is the judge), not yet made.
//
// Development is OpenAI gpt-5-nano (D-004, 2026-09-08) — the free OpenRouter
// model previously here documented that it does NOT enforce the response
// schema (the exact v1 Phase-12 failure class: a field silently drops from
// otherwise valid-shaped JSON, no warning surfaced). gpt-5-nano genuinely
// enforces its schema (`@ai-sdk/openai`'s `strictJsonSchema` defaults to
// true; OpenAI's own docs: responses "always adhere" to the schema, with only
// two escape hatches — a `refusal` field or truncation — both detectable, not
// silent) and costs ~$0.15/month at realistic dogfood volume: the free model
// was never actually saving anything measurable against that risk.
type Tier = 'development' | 'production'
type ModelRole = 'organize'

const tier: Tier = process.env.AI_MODEL_TIER === 'production' ? 'production' : 'development'

type ModelConfig = { provider: 'anthropic' | 'openai'; id: string }

const MODEL_CONFIG: Record<ModelRole, Record<Tier, ModelConfig>> = {
  organize: {
    development: { provider: 'openai', id: 'gpt-5-nano' },
    production: {
      provider: 'anthropic',
      // Confirm against the Anthropic console before the first production
      // deploy (Phase 5+); dev is what we build and eval against until then.
      id: 'claude-sonnet-5',
    },
  },
}

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })

// The model instance to pass to generateText({ model }).
export function model(role: ModelRole): LanguageModel {
  const config = MODEL_CONFIG[role][tier]
  return config.provider === 'anthropic' ? anthropic(config.id) : openai(config.id)
}

// The active model id string — stored in document_explanations.model so every
// explanation is traceable to the exact model that produced it (PRACTICES §7).
export function activeModelId(role: ModelRole): string {
  return MODEL_CONFIG[role][tier].id
}
