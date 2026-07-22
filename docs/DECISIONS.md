# CareAlign v2 — Decision Records

> Every language, stack, service, package, and non-obvious approach choice — with the alternatives it beat and why. Rule (see PRACTICES.md §2): nothing enters `package.json` or the architecture without an entry here. Inherited v1 choices are re-opened, not grandfathered. `Status: OPEN` entries block the phase that needs them.
>
> Template: Context → Options (table) → Choice → Why → Revisit trigger.

---

## D-001 — Application framework: Next.js 16 (App Router)

| Option | For | Against |
|---|---|---|
| **Next.js 16** | RSC + server actions fit our DAL/injection patterns; `after()` enables the non-blocking AI step; chassis + enforcement stack already built on it; Vercel deploy is zero-config | Framework churn risk; RSC mental-model complexity |
| Remix / React Router 7 | Simpler mental model, great forms | No `after()` equivalent as clean; whole chassis re-derived |
| Vite SPA + Hono API | Maximum control, smallest magic | Two codebases to secure/deploy; loses RSC data-locality; auth/session plumbing manual |
| Expo (React Native) | True mobile app — capture is mobile-first | Blocks web entirely; app-store friction contradicts ship-fast; PWA-grade web covers V1 capture |

**Choice:** Next.js 16. **Why:** the deciding factor is not fashion — it's that the 593-line enforcement stack, Supabase SSR wiring, and team knowledge already target it, and `after()` + server actions map 1:1 onto the capture pipeline. **Revisit:** if dogfooding shows mobile-web capture friction that only a native app fixes (trigger: founder stops using it because of the browser).

## D-002 — Backend: Supabase (Postgres + Auth + RLS)

| Option | For | Against |
|---|---|---|
| **Supabase** | Postgres + auth + RLS in one; FTS/trgm/pgvector native; hard-won two-layer discipline documented; local dev + migrations tooling | RLS complexity (mitigated: single `family_id` policy shape); vendor coupling (mitigated: it's plain Postgres underneath) |
| Neon + Drizzle + Better-Auth | Slick DX, serverless PG | Assembling auth+storage+RLS ourselves = more surface, less battle-tested for us |
| Firebase | Fast start | NoSQL modeling fights the relational timeline; no SQL FTS; export/migration pain |
| Convex | Reactive DX | Young ecosystem; proprietary query layer; our data is classic relational |

**Choice:** Supabase. **Why:** the product is a relational timeline with one clean tenancy rule — exactly what Postgres+RLS is for, and we carry scar tissue (GRANT+RLS, silent-0-row) that de-risks it. **Revisit:** sustained RLS performance issues at real scale.

## D-003 — File storage: **Supabase Storage — RESOLVED 2026-07-16 by spike**

| Option | For | Against |
|---|---|---|
| **Supabase Storage (chosen)** | Same vendor/billing/auth context; bucket colocated with the DB (Singapore); signed upload + signed read both proven; image transformations work on our plan | Slightly less turnkey client-upload DX than Blob |
| Vercel Blob (v1 inheritance) | Presigned pattern proven in v1 | A second vendor; measured 8x slower from India; private-blob reads need extra auth plumbing |
| Cloudflare R2 | Cheapest at scale, zero egress | Third vendor + manual presign plumbing; scale doesn't warrant it |

**Spike results (2026-07-16, founder's machine in India, 300KB payload, private `documents` bucket):** Supabase — signed-upload token 125ms, direct PUT 404ms (status 200), signed-read URL 79ms, read 384ms, **transform signed URL worked (200)**. Vercel Blob — upload 3,195ms, raw private URL read 403. Client-upload token flow = `createSignedUploadUrl` (server) + direct `PUT` (client) — bytes never transit our server.

**Consequences:** `@vercel/blob` and `BLOB_READ_WRITE_TOKEN` removed; capture pipeline uploads to the private `documents` bucket; the document-file route serves auth-checked signed URLs; thumbnails can use built-in transforms. **Revisit trigger:** egress costs at real scale.

## D-004 — Document-understanding model: Claude via AI SDK v6 — **eval-decided, provisional**

| Option | For | Against |
|---|---|---|
| **Claude (Haiku tier dev / Sonnet-class prod)** | Strong vision + instruction-following for the explain-never-advise constraint; team knows its failure modes; AI SDK abstracts swap | Cost vs alternatives unproven for OUR documents |
| Gemini Flash | Cheap, strong OCR reputation | Constraint-following on the advisory boundary unproven |
| GPT-4.1/5-mini class | Comparable | Same — unproven on our docs |
| Direct Anthropic SDK (no AI SDK) | One less abstraction | Loses cheap provider swap + structured-output ergonomics; v1 patterns all AI-SDK-shaped |

**Choice:** Claude via AI SDK as the starting point; **the Phase 2 eval set is the judge** — if another model scores equal-or-better on field accuracy AND boundary compliance at lower cost, we swap (the AI SDK makes that a one-line model-map change). **Revisit:** every eval run.

## D-005 — Retrieval: Postgres FTS + pg_trgm

Beat: pgvector-first (premature — no observed retrieval misses yet), Algolia/Typesense/Meilisearch (external service + sync pipeline for family-scale data is over-engineering). **Revisit trigger:** dogfooding logs real retrieval misses that keyword+fuzzy can't serve → add pgvector column (schema already accommodates).

## D-006 — Transactional email: Resend

Beat: SES (cheapest but console/deliverability toil), Postmark (excellent but pricier start). Resend: React-email templates, generous free tier, minutes to integrate. Low-stakes, easily swapped. **Revisit:** deliverability problems to Indian providers.

## D-007 — Observability: PostHog (one tool) + structured logs

| Option | For | Against |
|---|---|---|
| **PostHog** | Product analytics + session replay + web-vitals RUM + error tracking + feature flags in ONE tool; free tier fits; founder already uses it professionally; product-engineer workflow (watch real sessions) built-in | Error tracking younger than Sentry's |
| GA4 + Sentry + flags service | Each best-of-breed | Three integrations, three dashboards, for a team of one |

**Choice:** PostHog for everything + `createLogger` server logs. **Revisit:** if error tracking proves insufficient for server-side AI pipeline debugging, add Sentry for errors only.

## D-008 — Profile-PIN hashing: bcryptjs

Beat argon2 (stronger KDF but native-binding friction in serverless). Threat model is privacy-within-family, not credential stuffing — the account password (Supabase Auth) is the real security boundary. bcryptjs is pure-JS, serverless-safe, proven in v1's invite flow. **Revisit:** never likely; PIN is not a security credential.

## D-009 — Styling/components: Tailwind v4 + Shadcn (kept from chassis)

Re-justified rather than inherited blindly: 14 primitives already themed with our tokens; the alternative (Chakra/Mantine/vanilla) means re-theming for zero user-visible gain. Token namespaces renamed role-free in Phase 0. **Revisit:** not before V2.

## D-010 — Enum-like columns: text + CHECK constraints, not CREATE TYPE

| Option | For | Against |
|---|---|---|
| **text + CHECK** | Evolvable in one `ALTER TABLE ... DROP/ADD CONSTRAINT`; doc_type list WILL change as the eval set teaches us real Indian document categories; TS unions in `lib/types/domain.ts` are the type-safety layer anyway | Slightly weaker DB-side introspection |
| Postgres enums (v1 approach) | Self-documenting in `\dT` | Values can never be dropped; renames/removals need a full type swap with table rewrites |

**Choice:** text + CHECK everywhere (`documents.status/doc_type`, `appointments.status`, `profiles.sex`). **Why:** the churn risk is real and one-directional — v1 never removed an enum value only because v1 never learned from real documents. **Revisit:** never likely.

## D-011 — Timeline event-date fallback timezone: Asia/Kolkata

`documents_timeline_idx` orders by `coalesce(document_date, (captured_at at time zone 'Asia/Kolkata')::date)`. A bare `::date` cast is not IMMUTABLE (rejected in index expressions), so a timezone must be baked in. UTC would date evening captures (18:30–24:00 IST — prime after-clinic hours) as the previous day. V1 is India-first; the index expression and every query computing event date must match exactly. **Revisit trigger:** internationalization (requires index rebuild).

## D-012 — Explanation output shape: atomic, agent-consumable cited facts (not prose)

**Context:** the organize step produces the explain-never-advise output stored in `document_explanations`. The design question is *where the facts live* — inside the human-readable `what_it_says` prose, or in structured per-item fields. Prompted by "The Future of SaaS is Agentic" (akashyap.ai): the piece's one genuinely applicable idea for a consumer health vault is that the retrieval hero-moment should feel like the software assembling the answer, not a user operating a search box while a doctor waits — a bounded retrieval agent, already parked in V1.5 behind the north-star trigger. Its V1 footprint is a schema-shape decision made now, cheap now and expensive to retrofit.

| Option | For | Against |
|---|---|---|
| **Atomic cited facts (chosen)** | A V1.5 retrieval agent assembles "what meds is X on?" by pulling `medications_as_written` items across documents + joining `documents.document_date` — no re-parse, no re-inference, no fresh model call re-opening the fabrication risk closed at capture; `what_it_says` becomes a pure human summary that adds no fact absent from the structured fields | Slightly stricter prompt (every fact must land in a typed field, not just the prose) |
| Prose blob (`what_it_says` holds the facts) | One free-text field, simplest prompt | Facts trapped in a sentence; later extraction means fragile string-parsing or a fresh AI call — the exact re-inference the pipeline exists to avoid |

**Choice:** the structured arrays are the machine truth; `what_it_says` is a human summary only. **Footprint:** shape discipline within existing columns — **no new tables/columns.** `terms`/`medications_as_written`/`tests_as_written` stay jsonb; their item shapes are enforced in `OrganizeSchema` (Zod) + typed in `lib/types/domain.ts` (Rule 10). No agent is built in V1; this only keeps the V1.5 option open for free without widening V1 scope (Rule 15).

Item shapes (verbatim-or-null on every sub-field — absent on the document = `null`, never inferred):
- `Term { term, plain_explanation }` — defines the term generically; never interprets the patient's specific value.
- `Medication { name, strength|null, frequency|null, form|null }`.
- `LabTest { name, value|null, unit|null, reference_range|null, flag_as_written|null }`.

**Why these are free strings, not enums (evaluated and rejected):** narrowing clinical fields (`frequency`, `unit`, `form`, `flag_as_written`, …) to controlled vocabularies was considered for consistency. Rejected — it collides with verbatim-or-null: an enum forces the model to either normalize what the document says ("1-0-1" or "twice a day" → `BD`), which is a Rule-2 violation and a fabrication risk in a medical record, or drop non-matching values, which loses data that was on the document (capture is sacred). The document's exact text *is* the clinical content; a doctor needs "Metformin 500mg BD as written," not our interpretation. This mirrors FHIR, which always preserves original `text` even when a code exists. Consistency is instead enforced in the **prompt**: copy these fields **character-for-character as printed** — no case-fixing, no expanding abbreviations, no re-spacing. Any inconsistency is then the document's, faithfully preserved, not the model's invention. Coded companion fields (e.g. `form_code`) beside the verbatim ones are a V1.5+ option, decided from eval evidence (does free-text inconsistency actually hurt retrieval?), never a replacement. Global terminologies (LOINC/UCUM/RxNorm/SNOMED) ride with ABDM — out of V1 (Rule 15).

**`flag_as_written` (the explain-never-advise boundary call, founder-decided):** a printed abnormality marker ("HIGH" / "H" / "↑") *is captured verbatim* — verbatim-or-null permits copying what the document says, and refusing to show what the document itself prints is dishonest to the source. The advisory line is the system *generating* a severity judgment or computing in/out-of-range — which it never does. The UI renders `flag_as_written` visually neutral, labeled "as printed on the document." `reference_range` follows the same rule: copied as printed, never compared against the value. **Revisit trigger:** an eval case where a captured printed flag reads as the app's own assessment despite neutral rendering → reconsider dropping flags entirely.

---

*Add new entries above this line. An entry marked OPEN blocks the phase that depends on it.*
