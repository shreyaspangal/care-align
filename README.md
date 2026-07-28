# CareAlign

> A family's health history, organized and retrievable when the doctor asks.

## What this is

One family account (Netflix-style) holds profiles for each family member — no per-member logins, no roles. Members capture medical documents (photos/PDFs); AI **organizes and explains** them into a per-person timeline; the family retrieves the right record when a doctor asks (search + visit brief) and manages upcoming appointments.

The wedge is **retrieval at the doctor-visit moment**, not storage.

## What this is not

- Not medical advice — AI explains what a document says, never assesses severity or recommends action
- Not a hospital system integration
- Not a doctor finder
- Not a medication reminder app
- Not a coordinator/patient role split — a profile is a person, not a permission tier

## History

This is a greenfield rebuild in the same repo. The original "Patient Coordinator" concept (coordinator/patient role pair, single active hospitalisation episode) was torn down 2026-07-15 in favor of the family-vault model above. Its docs live read-only in `docs/archive/carealign-v1/`.

## Roadmap

| Phase | What | Status |
|---|---|---|
| 0 | Teardown, docs, CI, chassis rename | done (2026-07-15) |
| 1 | Foundation: schema, RLS, auth, profiles, PostHog | done (2026-07-17) |
| 2 | Capture + organize pipeline + eval set | in progress |
| 3 | Timeline + retrieval (visit brief mocked first) | pending |
| 4 | Visit brief + appointments + reminders | pending |
| 5 | Onboarding, landing, polish | pending |
| 6 | Dogfood with the founder's family | pending |

Full sequence and exit criteria: `docs/BUILD_PLAN.md`.

## Docs structure

```
/docs
  SYSTEM_DESIGN.md     Routes, schema, pipeline, diagrams
  PRACTICES.md         Engineering process + phase-gate checklist + tracking plan
  DECISIONS.md         Decision records (stack choices + rationale)
  BUILD_PLAN.md        Build sequence + exit criteria
  ANTI_PATTERNS.md     Scar tissue — what AI instinctively gets wrong in this stack
  AGENTIC_WORKFLOW.md  Claude Code workflow (subagents, models, skills)
  DESIGN_REVIEW_LENS.md Design review lens (Impeccable + PDP checklists)
  CONTENT_LOG.md       Session retro journal
  archive/carealign-v1/ v1 documentation (read-only history)
```

Rules layer (hard rules that govern every change): `CLAUDE.md`. Agent orientation: `AGENTS.md`.

## Quick start

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
