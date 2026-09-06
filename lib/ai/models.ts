import 'server-only'

import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { LanguageModel } from 'ai'

// Hard Rule 12: model strings live ONLY here. Callers ask by role and get the
// tier-appropriate model; swapping a model or tier is a one-line change here.
// Tier is env-driven (AI_MODEL_TIER); anything other than 'production' is dev.
//
// Production is Anthropic on purpose — Output.object on Anthropic is backed by
// real tool calling (confirmed in @ai-sdk/anthropic's source: it forces a JSON
// tool call when native structured output isn't available, so there is no
// unenforced path), meaning a required field cannot silently go missing.
//
// Development is TEMPORARILY a free OpenRouter model (2026-09-06, cost reasons
// during build-out) despite that model's own docs stating it does NOT enforce
// the response schema — this is a known, accepted risk for local dev only.
// Verified via research (docs/DECISIONS.md D-004) that this is a documented,
// recurring failure class on OpenRouter (fields silently drop from otherwise
// valid-shaped JSON, no warning surfaced) — the exact v1 Phase-12 failure.
// MUST switch back to an Anthropic/OpenAI model before any real eval scoring
// or pre-launch testing (D-004 revisit trigger) — a dev-tier default is not
// evidence of production readiness.

type Tier = 'development' | 'production'
type ModelRole = 'organize'

const tier: Tier = process.env.AI_MODEL_TIER === 'production' ? 'production' : 'development'

type ModelConfig = { provider: 'anthropic' | 'openrouter'; id: string }

const MODEL_CONFIG: Record<ModelRole, Record<Tier, ModelConfig>> = {
  organize: {
    // Free OpenRouter model IDs churn fast (delisted/relisted without
    // notice) — verify against https://openrouter.ai/api/v1/models before
    // assuming this id is still live; check supported_parameters includes
    // both 'tools' and 'response_format' before picking a replacement.
    development: { provider: 'openrouter', id: 'dots-studio/dots-3-note-preview:free' },
    production: {
      provider: 'anthropic',
      // Confirm against the Anthropic console before the first production
      // deploy (Phase 5+); dev is what we build and eval against until then.
      id: 'claude-sonnet-5',
    },
  },
}

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })

// The model instance to pass to generateText({ model }).
export function model(role: ModelRole): LanguageModel {
  const config = MODEL_CONFIG[role][tier]
  return config.provider === 'anthropic' ? anthropic(config.id) : openrouter(config.id)
}

// The active model id string — stored in document_explanations.model so every
// explanation is traceable to the exact model that produced it (PRACTICES §7).
export function activeModelId(role: ModelRole): string {
  return MODEL_CONFIG[role][tier].id
}
