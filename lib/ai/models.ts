import 'server-only'

import { createAnthropic } from '@ai-sdk/anthropic'
import type { LanguageModel } from 'ai'

// Hard Rule 12: model strings live ONLY here. Callers ask by role and get the
// tier-appropriate model; swapping a model or tier is a one-line change here.
// Tier is env-driven (AI_MODEL_TIER); anything other than 'production' is dev.
//
// Both tiers are Claude on purpose. The organize call uses Output.object, which
// on Anthropic is backed by tool calling — the schema is enforced at generation
// time, so a required field cannot silently go missing. A free OpenRouter model
// without tool calling degrades Output.object to prompt-based extraction with no
// enforcement: the exact v1 Phase-12 failure (a nested field vanished and only
// surfaced as a Zod error). OPENROUTER_API_KEY is therefore reserved for
// deliberate eval-time model comparison (D-004 revisit) inside the eval harness
// — never the default organize path. See DECISIONS.md D-004.

type Tier = 'development' | 'production'
type ModelRole = 'organize'

const tier: Tier = process.env.AI_MODEL_TIER === 'production' ? 'production' : 'development'

const MODEL_IDS: Record<ModelRole, Record<Tier, string>> = {
  organize: {
    development: 'claude-haiku-4-5-20251001',
    // Confirm against the Anthropic console before the first production deploy
    // (Phase 5+); dev is what we build and eval against until then.
    production: 'claude-sonnet-5',
  },
}

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// The model instance to pass to generateText({ model }).
export function model(role: ModelRole): LanguageModel {
  return anthropic(MODEL_IDS[role][tier])
}

// The active model id string — stored in document_explanations.model so every
// explanation is traceable to the exact model that produced it (PRACTICES §7).
export function activeModelId(role: ModelRole): string {
  return MODEL_IDS[role][tier]
}
