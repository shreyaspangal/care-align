# Patient Coordinator — AI Behaviour Spec

> The AI in this product does one job: translate medical jargon into plain language. This document defines exactly what that means — the input, the output shape, the failure cases, and the boundaries of what the AI is and is not doing.

---

## Prompt Versioning

Every time a prompt is materially changed (not just whitespace), increment the version. The current version is stored in `document_translations.prompt_version`.

| Version | Date | Change |
|---------|------|--------|
| v1 | Day 3 | Initial prompts for classify + translate + summarise |

**What counts as a material change:**
- Any change to the instruction set, output shape, or rules
- Model upgrade (e.g. moving from `claude-sonnet-4-6` to `claude-opus-4-8`)
- Constraint added or removed

**What does NOT count:**
- Whitespace or formatting
- Adding context variables (patient name, date) without changing instructions

When a prompt version increments, `document_translations` records with the old `prompt_version` can be selectively re-translated by running the new prompt against their original `file_key`. This is a manual operation — not automatic.

---

## Model Selection and Cost Management

| Step | Development model | Production model | Rationale |
|------|------------------|-----------------|-----------|
| Classification | `claude-haiku-4-5-20251001` | `claude-sonnet-4-6` | Classification is a simple labeling task. Haiku is accurate enough and ~20x cheaper for dev iteration. |
| Translation | `claude-haiku-4-5-20251001` | `claude-sonnet-4-6` | Use Haiku during prompt iteration. Switch to Sonnet when testing real documents for exit criteria. |
| Episode summary | `claude-haiku-4-5-20251001` | `claude-sonnet-4-6` | Same rationale. |

**Environment variable to control model tier:**
```bash
# .env.local
AI_MODEL_TIER=development  # uses Haiku for all steps
# AI_MODEL_TIER=production  # uses Sonnet for all steps
```

```typescript
// lib/ai/models.ts
const MODEL_MAP = {
  development: {
    classify: 'claude-haiku-4-5-20251001',
    translate: 'claude-haiku-4-5-20251001',
    summarise: 'claude-haiku-4-5-20251001',
  },
  production: {
    classify: 'claude-sonnet-4-6',
    translate: 'claude-sonnet-4-6',
    summarise: 'claude-sonnet-4-6',
  },
}
export const AI_MODELS = MODEL_MAP[process.env.AI_MODEL_TIER ?? 'development']
```

**Cost estimate per document upload (production, Sonnet):**
- Classification: ~500 input tokens + ~100 output = ~$0.002
- Translation: ~3,000 input tokens (document) + ~500 output = ~$0.014
- Summary regeneration: grows with episode size; assume ~5,000 tokens per call = ~$0.025
- **Total per upload: ~$0.04 per document** (ballpark, PDF page count dependent)

For a 10-document episode: ~$0.40 in AI costs. Acceptable for V1.

---

## Token and Page Limits

Claude has a context window limit. Large hospital bills or multi-page discharge summaries can be tens of pages. Without limits, a single upload could consume the full context window and fail silently.

**Limits enforced before calling Claude:**

```typescript
// lib/ai/limits.ts
export const AI_LIMITS = {
  maxFileSizeBytes: 10 * 1024 * 1024,   // 10 MB (also enforced in validate.ts)
  maxPdfPages: 20,                        // reject PDFs over 20 pages before sending to Claude
  maxInputTokensEstimate: 100_000,        // ~75 pages of text — well within Claude's window
}
```

For PDFs over 20 pages: return an error to the user — "This document is too long to process automatically. Try uploading individual sections." Do not attempt to truncate silently.

---

## Core Principle

The AI is a **translator**, not a clinician.

It does not:
- Generate medical advice
- Predict outcomes
- Recommend treatments
- Replace clinical judgment

It does:
- Classify what type of document this is
- Explain what the document says in plain language
- Identify what (if anything) needs to happen because of it
- Synthesise multiple documents into a coherent episode narrative

---

## Step 1 — Document Classification

### Input
- Document file (PDF or image) from Vercel Blob
- Episode context (patient name, existing document types in episode)

### Prompt
```
You are classifying a medical document for a patient's health record.

Classify this document and return structured JSON only.

Document types:
- prescription: medication instructions from a doctor
- lab_report: results from blood, urine, imaging, or other diagnostic tests
- discharge_summary: summary given when patient leaves hospital or completes care
- bill: charges for medical services, room, procedures, or medication
- observation_note: nursing or doctor notes about patient condition during stay
- other: anything that doesn't fit the above

Return JSON matching this exact schema. No additional text.
```

### Zod Schema
```typescript
const ClassificationSchema = z.object({
  type: z.enum([
    'prescription',
    'lab_report',
    'discharge_summary',
    'bill',
    'observation_note',
    'other'
  ]),
  suggested_name: z.string(),
  // Exact name as it appears on document, or best guess if unclear
  suggested_purpose: z.string(),
  // Plain language: "Pre-operation blood work" or "Day 3 ward bill"
  document_date: z.string().nullable(),
  // ISO date string if found on document, null if not found
  source_hospital: z.string().nullable(),
  source_department: z.string().nullable()
});
```

### Model + Temperature
```typescript
model: AI_MODELS.classify,
temperature: 0.0,  // classification is deterministic — zero randomness
```

### Failure Handling
- If Claude cannot determine type → default to `other`, flag for user review
- If document is not in English → classify as `other` with note "Non-English document — V3 will support regional languages"
- If document is unreadable (poor image quality) → return error, prompt user to re-upload

---

## Step 2 — Document Translation

### Input
- Document file from Vercel Blob
- Document type (from Step 1 classification)
- Patient name (for personalisation)
- Instruction: translate for a non-clinical family member

### Prompt
```
You are translating a medical document for a patient's family member.
The family member is not a medical professional.
The patient's name is {{patient_name}}.
This document is a {{document_type}}.

Your job:
1. Explain what this document says in plain language a non-medical person can understand
2. Explain what this specifically means for {{patient_name}}
3. List any actions that need to be taken because of this document

Rules:
- No medical jargon without explanation
- No assumptions beyond what the document states
- No medical advice or treatment recommendations
- If something is unclear in the document, say it is unclear — do not guess
- Keep language warm and human, not clinical

Return JSON matching the exact schema. No additional text.
```

### Zod Schema
```typescript
const ActionSchema = z.object({
  action_for: z.enum(['coordinator', 'patient', 'both']),
  description: z.string()
  // Plain language: "Buy Paracetamol 500mg from pharmacy — 10 tablets"
  // Not: "Administer acetaminophen 500mg PRN"
});

const TranslationSchema = z.object({
  plain_language: z.string(),
  // What this document says, explained simply
  // Min 2 sentences, max 8 sentences
  what_it_means: z.string(),
  // What this means specifically for this patient
  // 1-3 sentences
  actions: z.array(ActionSchema)
  // Empty array if no actions required — silence is valid
});
```

### Model + Temperature
```typescript
model: AI_MODELS.translate,
temperature: 0.1,  // slight variation allowed for natural language, not for facts
```

### Failure Handling
- If document contains no translatable medical content (e.g. blank page) → return error
- If actions array is empty → valid. Do not manufacture actions.
- If Claude is uncertain about a medical term → include the original term with "(we recommend asking your doctor what this means)" — never guess at meaning

---

## Step 3 — Episode Summary Regeneration

Triggered automatically on every document upload. Reads all DocumentTranslations for the episode and synthesises them into a living narrative.

### Input
- All DocumentTranslations for this episode (plain_language + what_it_means fields)
- Episode started_at date
- Patient name
- Current episode status

### Prompt
```
You are writing a plain-language health summary for a patient's family.
The patient's name is {{patient_name}}.
Their hospitalisation started on {{started_at}}.

Below are plain-language summaries of all medical documents from this episode, in chronological order:

{{document_summaries}}

Write a summary that:
1. Explains why the patient came to hospital (visit purpose)
2. Describes what has happened, in chronological order, in plain language
3. States the patient's current status in one short label and one sentence
4. Does NOT include actions or tasks — those are tracked separately

If nothing significant has changed since the last document, the status should
reflect stability — do not manufacture drama or urgency.

Return JSON matching the exact schema. No additional text.
```

### Zod Schema
```typescript
const EpisodeSummarySchema = z.object({
  visit_purpose: z.string(),
  // "Dad came in for investigation of chest pain and was admitted for
  //  cardiac monitoring and a scheduled procedure."
  timeline_summary: z.string(),
  // Chronological narrative. Paragraphs separated by \n\n
  // Each paragraph = one phase or significant event
  status_label: z.string().max(50),
  // Short: "Post-operation, under observation"
  // Max 50 characters — this is a badge/chip in the UI
  status_description: z.string().max(200)
  // One sentence: "Dad had the operation on Tuesday, currently resting
  //  in ward 4, doctor visits tomorrow morning"
  // Max 200 characters — this is a subtitle in the UI
});
```

### Model + Temperature
```typescript
model: AI_MODELS.summarise,
temperature: 0.1,  // slight variation for readable narrative; facts must not change
```

### Failure Handling
- If no DocumentTranslations exist yet → do not generate summary. Show empty state UI.
- If only one document exists → generate minimal summary from that one document
- If regeneration fails → keep previous EpisodeSummary, show "Last updated X hours ago" — do not show error to patient user

---

## What "Done" Looks Like for the AI

These are the three exit criteria from the product spec, applied to the AI specifically:

**Test 1 — Real document test:**
Upload your dad's actual blood test report. Read the `plain_language` output. Could he read this and tell you what it means for him — without you explaining anything? If no → the prompt needs work. Ship only when yes.

**Test 2 — Silence test:**
Upload a bill (no medical actions, no instructions). Verify `actions` array is empty. The product should not manufacture a task from a bill.

**Test 3 — Scope test:**
Claude should never return a recommendation like "you should ask your doctor about X medication" or "this result suggests Y condition." If it does → the prompt constraint is failing. Fix before shipping.

---

## Adversarial Test Cases

Run these before every prompt version increment. Each one tests a boundary the product must hold.

| Test | Input | Expected behaviour | Failure mode |
|------|-------|-------------------|--------------|
| Non-English document | A prescription written in Kannada | `type: other`, note "Non-English document" | AI translates it anyway and invents English content |
| Non-medical file | A WhatsApp screenshot of a family chat | `status: failed`, error returned | AI invents a medical classification |
| Bank statement | A PDF bank statement | `type: other`, translation returns no actions | AI extracts "payment" actions from financial data |
| Blank / corrupt image | A 1px white JPG | `status: failed`, "unreadable document" error | AI returns empty strings that pass Zod validation |
| Multi-page bill (>20 pages) | A 25-page itemised hospital bill | Rejected before Claude call, user shown page limit error | File sent to Claude, hits token limit, fails expensively |
| Scope violation | Any document | `actions` contains no medical recommendations | AI returns "you should consider asking your doctor about X" |
| Silence test | A bill with no care instructions | `actions: []` returned | AI manufactures tasks from line items |
| Re-upload same document | Upload same prescription twice | Second upload detected as duplicate, returns existing `documentId` | Two Document records created for the same file |

These tests are documented in `__tests__/ai/adversarial.test.ts` and run with MSW mocking Claude responses. See TESTING.md for the full setup.

---

## When Required — Task Category Lookup

Used by the coordinator to understand when a document typically generates tasks. Claude does not use this — it is reference for the UI layer.

| Document Type | Common Task Categories |
|--------------|----------------------|
| prescription | medication, lifestyle |
| lab_report | test_results, doctor_visit |
| discharge_summary | medication, lifestyle, doctor_visit, insurance, payment |
| bill | payment, insurance, forms |
| observation_note | (rarely generates tasks) |
