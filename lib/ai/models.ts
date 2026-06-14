// Model and provider selection is controlled by AI_MODEL_TIER env var.
// development → OpenRouter free models (no API cost, for local dev + CI)
// production  → Anthropic Sonnet via @ai-sdk/anthropic (for real documents)
//
// To switch provider, change this file only — classify/translate/summarise
// import the pre-built model instances from here (CLAUDE.md rule 3).
//
// OpenRouter setup:
//   1. Get a free key at openrouter.ai
//   2. Set OPENROUTER_API_KEY in .env.local
//   3. Set AI_MODEL_TIER=development (default when not set)

import { createOpenAI } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'

const isDev = process.env.AI_MODEL_TIER !== 'production'

// OpenRouter uses an OpenAI-compatible endpoint.
// Free models available at openrouter.ai/models?q=free
const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
})

// Gemma 4 31B — free on OpenRouter, vision-capable (reads PDFs/images natively),
// 262K context, 140+ languages including Hindi. Text-only fallback if unavailable:
//   meta-llama/llama-3.3-70b-instruct:free    — text only, no file input
//   nousresearch/hermes-3-llama-3.1-405b:free — text only, best structured output
const FREE_MODEL = 'google/gemma-4-31b-it:free'

export const AI_MODELS = isDev
  ? {
      classify: openrouter(FREE_MODEL),
      translate: openrouter(FREE_MODEL),
      summarise: openrouter(FREE_MODEL),
    }
  : {
      classify: anthropic('claude-haiku-4-5-20251001'),
      translate: anthropic('claude-haiku-4-5-20251001'),
      summarise: anthropic('claude-haiku-4-5-20251001'),
    }
