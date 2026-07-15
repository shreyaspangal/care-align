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

## D-003 — File storage: **OPEN — resolve in Phase 1, before capture build**

| Option | For | Against |
|---|---|---|
| Vercel Blob (v1 inheritance) | Client-upload tokens work well; presigned pattern proven in v1 | **A second vendor** for something Supabase already includes; per-GB pricing separate; v1 chose it without comparison |
| **Supabase Storage (leaning)** | Same vendor/billing/auth context; bucket policies align with RLS mental model; signed + resumable (TUS) uploads; built-in image transformations (could serve thumbnails) | Slightly less turnkey client-upload DX than Blob; egress pricing to verify |
| Cloudflare R2 | Cheapest at scale, zero egress | Third vendor + manual presign plumbing; scale doesn't warrant it |

**Leaning:** Supabase Storage — one vendor, one auth context, and image transformations replace a thumbnail step we'd otherwise build. **Resolution criteria (Phase 1 spike, ≤2h):** confirm client-upload token flow + signed-URL serving + transformation latency from India. This entry exists precisely because v1 never compared — decide with evidence, then close.

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

---

*Add new entries above this line. An entry marked OPEN blocks the phase that depends on it.*
