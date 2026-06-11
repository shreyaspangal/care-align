# Progress — as of 2026-06-11

This file exists for Claude on claude.ai which cannot walk GitHub subdirectories.
It is the honest current state of the implementation, updated before every session.

---

## Pipeline (working end-to-end?)

| Step | Status | Notes |
|------|--------|-------|
| Auth → profile creation | ✅ Working | `handle_new_user` trigger + 3 fix migrations for grants |
| Patient + episode creation | ✅ Working | `createPatient` action + `createEpisode` action; service client for chicken-and-egg |
| Upload → Blob → document record | ✅ Working | `uploadDocument` action, Vercel Blob private store, `file_key` pathname pattern |
| Rate limiting | ✅ Working | Upstash Redis, 10 uploads/hour/user |
| Classify step (Claude call) | ❌ Not started | `lib/ai/models.ts` exists (Haiku/Sonnet tier config), no `classify.ts` yet |
| Translate step + document_actions | ❌ Not started | Schema designed in `docs/AI_BEHAVIOUR.md`, not implemented |
| Episode summary regeneration | ❌ Not started | `upsert_episode_summary` RPC exists in DB, no `summarise.ts` yet |
| Authenticated file serving | ✅ Working | `/api/documents/[documentId]/file` — RLS-enforced signed URL |

**Bottom line:** upload pipeline works end-to-end up to Blob storage. Claude integration (classify → translate → summarise) is the entire unbuilt layer — this is Phase 6.

---

## Screens (renders real data / UI only / missing)

| Screen | Status | Notes |
|--------|--------|-------|
| Login | ✅ UI complete | Full 7-rule Zod form contract, calls real Supabase auth |
| Register | ✅ UI complete | Same pattern, role selection |
| Coordinator dashboard index | ✅ UI complete | 0 patients → add form; 1+ patients → list with Add CTA |
| Add patient (`/dashboard/new`) | ✅ UI complete | Back navigation, CreatePatientForm |
| Patient page (`/dashboard/[patientId]`) | ✅ UI partial | Shows patient name + upload zone; no translation output yet (Phase 6+) |
| Create episode CTA | ✅ Working | `CreateEpisodeButton` — no episode state shows working button |
| Document upload zone | ✅ UI complete | Drag-drop, file validation, Blob upload, sonner toast on success |
| Translation output panel | ❌ Missing | `TranslationOutputPanel` component not built — needs Phase 6 first |
| Episode summary panel | ❌ Missing | `EpisodeSummaryPanel` component not built |
| Episode timeline | ❌ Missing | `EpisodeTimeline` feature component not built |
| Patient read-only view (`/patient/[patientId]`) | ❌ Shell only | Redirects to `/patient/[id]` but that route doesn't exist yet |
| Pending tasks view | ❌ Missing | No tasks page, no resolve-task action |

---

## Components

### Primitives (all built + Storybook stories)
- `DocumentTypeTag` — document type label (prescription, lab_report, discharge_summary, bill, etc.)
- `EpisodeStatusBadge` — episode status pill (active, care_complete, closed)
- `TaskCategoryIcon` — icon for task category (pharmacy, follow_up, billing, etc.)
- `TranslationStatusIndicator` — translation status with retry for failed state

### Composites (all built + Storybook stories)
- `DocumentCard` — document tile with type tag + status indicator
- `PendingTaskRow` — task row with category icon + resolve button (UI only, no action wired)
- `EpisodeStatusCard` — episode header with status badge + started date

### Features (built)
- `DocumentUploadZone` — full upload flow with drag-drop, validation, loading, error, toast
- `CreatePatientForm` — Zod-validated form
- `CreateEpisodeButton` — server action wired, handles pending + error state

### Features (missing — Phase 6+)
- `EpisodeTimeline` — list of DocumentCards in chronological order
- `TranslationOutputPanel` — Shadcn Sheet showing plain_language + actions
- `EpisodeSummaryPanel` — living summary with status card + open task count

---

## Infrastructure

| Item | Status |
|------|--------|
| Supabase schema + RLS | ✅ Live (full 9-table schema + RLS policies + grants) |
| Vercel Blob store | ✅ Live (private, Mumbai/BOM1 region) |
| Upstash Redis | ✅ Live |
| Anthropic API key | ✅ In `.env.local` (not yet called from code) |
| Vercel deployment | ❌ Not deployed |
| Architecture lint gates | ✅ `pnpm lint:arch` — stories + primitives + schemas |
| PostToolUse hooks | ✅ `.claude/settings.json` — story + form contract checks |
| Test suite | ✅ 101 passing, 9 skipped (unit + Storybook interaction) |

---

## Known broken / blocked

- Patient read-only view (`/patient/[patientId]`) — the redirect target route does not exist yet. A logged-in patient gets redirected to a 404.
- No translation output anywhere — the entire Claude pipeline (classify → translate → summarise) is unbuilt. Upload works but nothing happens after.
- `PendingTaskRow` resolve button — wired to no action, placeholder only.

---

## What's next (Phase 6)

1. `lib/ai/classify.ts` — `generateObject` call with `ClassificationSchema`, update document record
2. `lib/ai/translate.ts` — `generateObject` call with `TranslationSchema`, create `document_translations` + `document_actions` rows
3. `lib/ai/summarise.ts` — `generateObject` call with `EpisodeSummarySchema`, call `upsert_episode_summary` RPC
4. Wire all three into `actions/upload-document.ts` in sequence
5. `EpisodeTimeline`, `TranslationOutputPanel`, `EpisodeSummaryPanel` feature components
6. Patient view (`/patient/[patientId]`) — read-only, translations + summary only

Zod schemas for Claude output (ClassificationSchema, TranslationSchema, EpisodeSummarySchema) are designed in `docs/AI_BEHAVIOUR.md` but not yet in code.

---

## File layout (key paths)

```
actions/          auth.ts, create-patient.ts, create-episode.ts, upload-document.ts
app/
  (auth)/         login, register
  (coordinator)/  dashboard/page.tsx (list), dashboard/[patientId]/page.tsx, dashboard/new/page.tsx
  (patient)/      patient/page.tsx (redirect only — target missing)
  api/            documents/[documentId]/file/route.ts
components/
  primitives/     DocumentTypeTag, EpisodeStatusBadge, TaskCategoryIcon, TranslationStatusIndicator
  composites/     DocumentCard, PendingTaskRow, EpisodeStatusCard
  features/       DocumentUploadZone, CreatePatientForm, CreateEpisodeButton
docs/             ARCHITECTURE.md, AI_BEHAVIOUR.md, BUILD_PLAN.md, COMPONENT_PLAN.md,
                  DATA_MODEL.md, FORMS.md, ROADMAP.md, TESTING.md, CONTENT_LOG.md
lib/
  ai/             models.ts (tier config only — no classify/translate/summarise yet)
  storage/        blob.ts, validate.ts
  supabase/       client.ts, server.ts, service.ts
  validation/     schemas.ts (LoginSchema, RegisterSchema, CreatePatientSchema, DocumentFileSchema)
  logger.ts, ratelimit.ts
scripts/          check-stories.mjs, check-primitives.mjs, check-schemas.mjs, seed-dev.ts
supabase/migrations/  initial_schema + 3 fix migrations
```
