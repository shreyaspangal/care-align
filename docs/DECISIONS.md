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

---

*Add new entries above this line. An entry marked OPEN blocks the phase that depends on it.*
