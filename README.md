# Patient Coordinator

> A product built from personal experience. Not a records app — a comprehension layer for the two people who need it most during a hospitalisation.

## What this is

A web application for the **coordinator-patient pair** during an active hospitalisation episode.

- **For the coordinator:** A single place that tracks all documents, proceedings, and pending tasks — so nothing crucial is missed while managing work and hospital simultaneously.
- **For the patient:** Plain language answers to their questions about what is happening to them — without waiting for a doctor to appear.

## What this is not

- Not a hospital system integration
- Not a doctor finder
- Not a medication reminder app
- Not a full EHR replacement
- Not a general health records storage app

## The core job

> Take medical jargon from fragmented documents across departments and hospitals, and turn it into a coherent, plain-language health story that the patient and coordinator actually own and understand.

## Roadmap summary

| Version | Focus | Status |
|---------|-------|--------|
| V1 | Translation — documents become plain language | 🔨 Building |
| V2 | Extraction — medications, care tasks pulled automatically | 📋 Planned |
| V3 | Voice + Language — Sarvam AI integration for regional languages and voice-first interaction | 📋 Planned |

## Docs structure

```
/docs
  ROADMAP.md          Version-wise feature scope
  ARCHITECTURE.md     Technical decisions and stack rationale
  DATA_MODEL.md       Full schema with reasoning
  SPEC.md             Product spec — the why behind every decision
  BUILD_PLAN.md       5-day V1 execution plan
  AI_BEHAVIOUR.md     AI pipeline spec — prompts, schemas, failure handling
  COMPONENT_PLAN.md   Primitive component architecture
  CONTENT_LOG.md      Build journey capture — daily decisions and insights
```

## Quick start (after Day 1 setup)

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

## Built by

Shreyas Pangal — frontend engineer building at the intersection of high-stakes data and AI interfaces.
Personal experience: managed a family hospitalisation and watched the coordinator-patient information gap cause real harm.
