# CareAlign v2 — Engineering Practices

> The answer to "how do we ensure we're always on the right track?" is not vigilance — it's machinery. Every practice here is a checklist item, a CI job, or a file that must change alongside code. Gaps found later become new checklist items, not regrets. Inspired by PostHog's product-engineer handbook: ship early, instrument everything, measure impact, write decisions down.

---

## 1. The development loop (every phase)

```
design delta → decide (DECISIONS.md) → build → instrument → dogfood → retro → gate
```

No phase is "done" at working code. It is done when it is **instrumented** (events firing, errors captured), **dogfooded** (used with real data by the founder), and **retroed** (CONTENT_LOG entry answering: what did we learn? what gap appeared? what decision needs recording?).

## 2. Decision records — no assumptions rule

Every choice of language, framework, service, package, or non-obvious approach gets an entry in `docs/DECISIONS.md` **before it enters `package.json` or the architecture**: context → options compared (table) → choice → why → revisit trigger. Inherited v1 choices are NOT exempt — they get re-opened and either re-justified or replaced (see D-003, which is deliberately left open). A decision without a recorded alternative is an assumption; assumptions are bugs in the process.

## 3. Diagrams — living, not decorative

Mermaid diagrams live in `docs/SYSTEM_DESIGN.md` §Diagrams (rendered natively by GitHub): **ER diagram, capture-pipeline sequence, frontend layer architecture, user-flow map**. The rule: any change that alters a flow, table, or boundary updates the diagram **in the same commit** — the phase gate checks "diagrams current". Diagrams that can drift from code are worse than no diagrams.

## 4. Testing — right-sized pyramid, honestly scoped

| Layer | What | When it runs |
|---|---|---|
| Types + lint | `tsc --noEmit`, `pnpm lint:arch` (custom AST rules incl. v2 hard rules) | pre-commit + CI |
| Unit | Zod schemas, lib functions, capture helpers (vitest) | CI |
| **RLS proof tests** | Scripted second-user attempts against every table — must return 0 rows. The v1 silent-failure lesson, automated. Extended 2026-09-08 to `storage.objects` for the `documents` bucket (`__tests__/rls/storage-objects-rls-proof.test.ts`, `docs/ANTI_PATTERNS.md` #11) — found and fixed a real gap in the same pass: no DELETE policy existed, so no one, including the owning family, could delete an uploaded file (Rule 3 permits user-deletion; fixed in `supabase/migrations/20260908000001_storage_documents_rls_delete.sql`). | CI (against local Supabase) |
| Stories | Every component has a current `.stories.tsx` (check-stories) | pre-commit + CI |
| **AI evals** | Eval set + scorer (§6). CI replays committed model recordings through the real scorer (`pnpm eval:smoke`) — proves the harness works, scores nothing. The scored run (`pnpm eval`) hits the live model, so it stays manual. | CI (smoke); live run on every prompt/model change + weekly |
| E2E | **Deliberately deferred** until users beyond the founder's family exist (revisit trigger). Dogfooding with real data covers the integration surface at current scale — this is a decision, not an omission. |

The v1 anti-pattern being killed here: TESTING.md described a suite that never existed. v2 rule: **this table may only list what CI actually runs** — adding a row and adding the CI job is one commit.

## 5. CI — exists before the first feature

GitHub Actions on every push/PR, set up in Phase 0 (before any feature code): `tsc` → `lint:arch` → `vitest` → `check-stories` → RLS proof tests (Phase 1+) → eval smoke (Phase 2+, cached responses). Red CI blocks the phase gate. The pre-commit hook mirrors the fast subset locally.

## 6. AI evals — the regression suite for the product's core

- **Eval set:** 10–15 real family documents (user-supplied, anonymised), each with expected extractions (`doc_type`, dates, names, medications-as-written) — grows with every organize failure found in dogfooding (failure → new eval case, permanently). One directory per case under `eval/cases/`: the document, an `expected.json`, and a recorded `cached-response.json`. **Fixture status (synthetic placeholders vs. real documents) lives in `eval/cases/README.md`** — that file is the single source of truth for it.
- **Scoring:** field accuracy per document (split into **fabrications** — a wrong non-null value — vs. **omissions** — an honest null, per DPDP Act s.8(3)) + a **boundary check**: any advisory language (severity, recommendation, norm comparison) in the output is a **hard fail** regardless of accuracy. The scorer is `lib/eval/score.ts`; the advisory patterns are an explicit, extensible list scanning only the prose the model composes itself (`what_it_says`, `terms[].plain_explanation`, and `title` when AI-composed) — never verbatim transcriptions like `flag_as_written`, where "HIGH" is the document speaking (D-012). It is a heuristic safety net with real false negatives, not a replacement for reading output during dogfooding. **Both the boundary-check categories and the fabrication/omission split are grounded in specific Indian regulatory sources, not just internal judgment — `docs/DECISIONS.md` D-014 is the single source of that research, and `docs/INDIA_COMPLIANCE.md` is the live rule checklist + enforcement pointers + user-facing trust copy derived from it; this file doesn't restate either.**
- **Harness:** `pnpm eval` runs the live model (per `lib/ai/models.ts`, Hard Rule 12), scores, and writes `eval/results/<timestamp>-<prompt_version>.json`. `pnpm eval:smoke` replays each case's committed recording through the same scorer — no API key, no network — and is what CI runs. **Cached mode proves the harness still works; it says nothing about whether the model or prompt is good today.** Its exit code fails on harness breakage (scorer self-check, fixtures no longer matching `OrganizeSchema`) **and on any boundary violation found in a committed fixture** (a leak baked into a recording is a repo defect, not a fact about "the model today") — never on a plain accuracy mismatch, which stays informational in cached mode. `--record` itself refuses to save a fixture that has a boundary violation. Details: `eval/README.md`.
- **Gate:** no prompt or model change merges if the eval score regresses. Scores logged per `prompt_version` in `eval/results/` so the history is inspectable. Comparing runs is a human read of two JSON files while the eval set is placeholder data.
- Model comparison (e.g., Claude vs. alternatives for Indian medical docs) is decided BY this eval set, not by vibes (see D-004) — and D-004's revisit trigger gates it: a live run is only a real score with `AI_MODEL_TIER` on a schema-enforcing provider.

## 7. Observability — from the first feature, not after the first incident

- **Product analytics: PostHog** (one tool for events, session replay, web vitals RUM, error tracking, feature flags — see D-007). A written **tracking plan** lives in this file's appendix and only grows via PR.
- **Server logs:** structured `createLogger` (kept from v1) on every action and the organize pipeline.
- **AI telemetry:** every organize call records `prompt_version`, model, latency_ms, token counts, outcome (`organized`/`needs_review`) — as columns on `document_explanations` + a PostHog event. Cost and failure-rate are dashboard queries, not archaeology.
- **Alerts (minimal):** organize failure-rate spike and reminder-cron failure — the two silent-death paths.

### Appendix: tracking plan (v1 events)

| Event | Fired when | Key props |
|---|---|---|
| `account_registered` | family account created (server action) | email_confirmation_required |
| `user_logged_in` | successful login (server action) | — |
| `profile_created` / `profile_updated` | profile CRUD (server actions) | has_date_of_birth, has_sex (Phase 5 adds `via: onboarding_proposal \| manual`) |
| `profile_selected` | picker tile tapped (client) | is_pin_protected |
| `profile_unlocked` | PIN unlock success (server action) | authentication_method |
| `capture_started` / `capture_completed` / `capture_failed` | upload lifecycle | mime, bytes, retry_count |
| `organize_completed` / `organize_needs_review` | AI pipeline | doc_type, latency_ms, prompt_version |
| `document_corrected` | manual fix after needs_review | field(s) corrected |
| `search_performed` / `search_result_opened` | retrieval | query_len, results_count |
| `visit_brief_opened` / `visit_brief_printed` | the hero moment | profile_age_bucket |
| `appointment_created` / `reminder_sent` | loop | days_ahead |

Identity: `identify(supabase user id)` on register/login and on authenticated page load (`PostHogIdentify`); email stored as a person property only; `posthog.reset()` on logout. No profile names, PINs, or health data in any event property.

North-star check (monthly, PostHog): **retrieval moments per family per month** (search + brief opens). If it trends to zero, the wedge thesis is wrong — that's the number that decides V1.5, per the product-engineer principle of measuring impact, not output.

## 8. Phase-gate checklist (the literal list, run every time)

1. `tsc` / `lint:arch` / `vitest` / stories — green locally AND in CI
2. RLS proof tests green (Phase 1+); eval score ≥ previous (Phase 2+) — check `AI_MODEL_TIER` is not pointed at a dev-only free model before running the eval for real (DECISIONS.md D-004's revisit trigger)
3. New events from the tracking plan firing (verified in PostHog live view)
3a. Opened the deployed URL (not just localhost) and walked this phase's happy path — everything above verifies the local/CI environment, never the one users actually touch
4. Diagrams current with this phase's changes
5. DECISIONS.md updated for anything new that was chosen
6. Dogfooded with real data; failures converted to eval cases / issues
7. CONTENT_LOG retro entry (learned / gap / decision)
8. Layer-grouped commits, founder-confirmed, `git status` clean
