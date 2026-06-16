# CareAlign — Content Log

> Daily capture of the building journey. Raw notes only — no editing, no formatting. The editing happens later. The only rule: capture it the same day it happened.

---

## The Three Questions

At the end of every build session, answer these three:

1. **What did I decide today?** — Not what you built. What decision you made and what you were choosing between.
2. **What resisted me today?** — The moment where something was harder than expected. The friction. The doubt. The temptation to pivot.
3. **What did I understand today that I didn't yesterday?** — The insight that shifted something.

---

## Coordinator Shell + Upload UX — 2026-06-16

**What did I decide?**

Two batches of work shipped together as one commit.

**Batch 1 — Coordinator sidebar + view restructure:**
Replaced the full-width header-only coordinator shell with a persistent 240px sidebar on desktop. The sidebar holds the patient list (active patient highlighted in brand teal, admission status as a colour dot), "Add patient" link with active state on `/dashboard/new`, and the user identity + sign out at the bottom. Mobile keeps the existing teal header. PatientTabNav converted from a fixed bottom strip to an inline top strip with three tabs: Documents (default) | Summary | Tasks. The Summary tab is a new route (`/dashboard/[patientId]/summary`) that owns `EpisodeSummaryPanel` — previously it was above the upload zone on the Documents tab. The `[patientId]/layout.tsx` now owns the patient header (name + status) so it isn't repeated across three pages. Tabs have no background — they sit against the page background, scoped to content width. Back link and "Add patient" button are `lg:hidden` since the sidebar replaces them on desktop.

**Batch 2 — Six upload zone + card fixes:**
1. Sidebar "Add patient" active highlight when on `/dashboard/new`.
2. Mobile-only visibility for "← All patients" and "Add patient" button.
3. Patient header + tabs moved into layout — pages render content only.
4. Document type selector: replaced native `<select>` with Shadcn Combobox (Popover + Command). "Other (custom)" is part of the main list. "Clear selection" is anchored at the bottom, always visible, disabled when nothing selected. Custom type shows inline input inside the popover — no second field below.
5. Hospital field: Google Maps Places API (New) integration using `AutocompleteSuggestion.fetchAutocompleteSuggestions`. Loaded via Next.js Script in coordinator layout with `loading=async`. Falls back to plain input if key not set. Requires "Maps JavaScript API" + "Places API (New)" enabled in Google Cloud Console.
6. Uploaded document card restructured: `[title] [type-tag][delete]` / `[description]` / `[Issued at: date · Uploaded on: time] [Translated/Failed]`. Delete opens a confirmation Dialog before executing. `created_at` added to `EpisodeDocument` type and DAL query. Uploaded documents section moved outside the upload card — plain heading with sort dropdown (Newest/Oldest/By type), documents below without a card wrapper. `DocumentsSection` client component handles sort state.

**What resisted me?**
Google Places API migration was the friction point. `use-places-autocomplete` (the popular library) uses `AutocompleteService` which Google deprecated for new customers in March 2025. Installed it, got warnings, checked the actual API docs, removed it, and reimplemented directly against `AutocompleteSuggestion.fetchAutocompleteSuggestions` — the correct new API. The 403 after that was purely a Cloud Console permissions issue (Places API not enabled), not a code issue. The implementation was correct on the first try once the library was removed.

**What did I understand?**
Popular npm packages lag behind API deprecations by months or years. `use-places-autocomplete` v4.0.1 (published recently) still wraps a deprecated API. Reading the official migration docs first and implementing directly against the new interface saved a third dependency and produced cleaner code. The check was worth the 10 minutes.

---

## Pre-Build — Spec and Architecture

**Date:** Before first commit

**What did I decide?**
Spent the first session writing docs instead of code. Wrote the full data model, architecture decisions, build plan, and component plan before touching any implementation. The decision was: spec first, build second. The alternative was to start building and figure it out as I go — which is what most people do.

**What resisted me?**
The temptation to just start. Every instinct said "open the editor, write some code, figure out the schema later." Writing a 500-line data model document when nothing works yet feels like procrastination. It isn't — but it feels like it.

**What did I understand?**
The difference between a spec and a plan. A plan tells you what to build. A spec tells you what the thing *is* — what it does, what it doesn't do, who uses it and why. The spec is what lets an AI agent work without constantly asking you what you meant. Writing it is not overhead. It is the work.

---

## Phase 1 — Foundation + Test Harness

**Commit:** `5d8c307`

**What did I decide?**
Set up MSW (Mock Service Worker) for tests before writing a single component. The decision was between mocking Claude API calls in tests vs. hitting the real API. Chose MSW — it intercepts at the network layer, which means the test code is identical to production code. The mock lives in one place, not scattered across test files.

**What resisted me?**
Understanding why `onUnhandledRequest: 'error'` matters. The default is to silently let unhandled requests through — which means a test can pass while making real network calls you don't know about. Setting it to error forces every network call to be explicitly declared. It felt like extra strictness for no reason until you understand what it prevents.

**What did I understand?**
A test harness is not just about running tests. It is about making the failure modes explicit. Silent network leaks in tests are the same as silent failures in production — you don't know something is wrong until it causes a problem somewhere else.

---

## Phase 2 — Database Schema + RLS

**Commit:** `0daba7d`

**What did I decide?**
Three concepts that look identical on the surface but are fundamentally different: Authentication (`auth.users`), Profile (`profiles`), and Access Grant (`patient_access`). The decision was to keep them as three separate tables rather than collapsing them. The temptation was to put role directly on the user and be done with it.

Chose Supabase + Postgres over Firebase, PlanetScale, and DynamoDB. The deciding factor: Row Level Security enforced at the database layer, not the application layer. Medical data that relies solely on application-level access control is one missed `if` statement away from a breach.

**What resisted me?**
The migration failed on first push with `ERROR: relation 'patient_access' does not exist (SQLSTATE 42P01)`. The helper function `user_has_patient_access()` was defined before the `patient_access` table existed. Postgres compiles function bodies at definition time — the table didn't exist yet. Fixed by reordering: enums → tables → trigger → helper fn → RLS → RPC. The order is not arbitrary. It is load-bearing.

**What did I understand?**
RLS is not a feature. It is a constraint on yourself. When RLS is on, even you — the developer — cannot accidentally read data you shouldn't. The database enforces the access model, not your application code. That matters when the data is someone's medical records.

**One thing that surprised me:**
The `upsert_episode_summary` RPC exists entirely to protect a version counter. A plain `.upsert()` in the Supabase JS client would reset `version` to whatever value you pass in. The RPC does `version = episode_summaries.version + 1` atomically. One SQL function prevents an entire class of race condition bugs.

---

## Phase 3 — Auth, Proxy Routing, Supabase Clients

**Commit:** `187a718` + fix `649aab4`

**What did I decide?**
Two Supabase clients, not one. A server client (`lib/supabase/server.ts`) that is async and reads/writes cookies — used in Server Components and Server Actions. A browser client (`lib/supabase/client.ts`) that is synchronous — used in Client Components only. The split is not stylistic. The server client uses the publishable key and cookie storage. The browser client also uses the publishable key — safe because RLS enforces access at the database layer regardless of which key is used.

Used `getUser()` in proxy.ts, never `getSession()`. `getSession()` trusts the cookie blindly — it does not validate the JWT against Supabase's servers. If someone crafts a fake cookie, `getSession()` accepts it. `getUser()` makes a network call to verify. For routing decisions that gate access to medical data, trust must be verified, not assumed.

**What resisted me?**
Next.js 16 breaking changes. `cookies()` is async-only — the sync version was removed. `middleware.ts` is renamed to `proxy.ts` with a `proxy` named export. Dynamic route params are Promises and must be awaited. None of these are in the model's training data for Next.js 15. Every assumption had to be checked.

**What did I understand?**
Session refresh has to happen in the proxy, not the component. When Supabase refreshes an auth token, it writes new cookies. In a Server Component, cookies are read-only — the write silently fails. The proxy runs before every request and has write access to both request and response cookies. That is the only place where token refresh works correctly.

---

## Phase 4 — UI Primitives, Composites, Auth Pages, Storybook

**Commit:** `b8cfb3a`

**What did I decide?**
Built primitives before composites before features. Never the other way. Each primitive covers exactly one concept: document type, episode status, task category, translation status. Each composite assembles from primitives only — no new atoms invented inside a composite. This constraint felt artificial until a bug appeared: `<button>` cannot contain `<button>` in HTML. `DocumentCard` was a button. `TranslationStatusIndicator` in failed state is also a button. The constraint forced the fix: `DocumentCard` becomes a `div` with `role="button"` instead.

Added Storybook with the goal of evolving these components into a public healthcare UI library — same model as MagicUI/Aceternity but domain-specific. Stories are colocated with components, not in a separate `stories/` folder. Each story covers every prop value, not just the happy path.

**What resisted me?**
Storybook's CSS check. Tailwind v4 uses `oklch` colour space internally, not `rgb`. The CssCheck story asserted `rgb(239, 246, 255)` for `bg-blue-50` — which is correct in Tailwind v3. In v4 the computed value is `oklch(0.97 0.014 254.604)`. The test failed, which is exactly what it is supposed to do: prove that CSS actually loaded and that the values match what the browser computes, not what you assume.

Auth errors originally returned `{ error: string }` from Server Actions. TypeScript rejected this — form `action` props must return `void`. Fixed by redirecting to `?error=` query params instead. The page reads `searchParams` and renders the error inline.

**What did I understand?**
Storybook is not a testing tool. It is a contract. When you write a story for every prop value, you are writing down what the component is supposed to do in a form that is both human-readable and machine-verifiable. An agent reading the story file knows exactly what the component accepts, what it renders, and what it should not do. That is more precise than a comment and more durable than a doc.

**One thing that surprised me:**
The `CssCheck` story caught a real incompatibility between Tailwind v3 assumptions and Tailwind v4 reality on the first run. A test that proves CSS loaded is not paranoid. It is the only way to know Storybook is rendering with the actual styles and not unstyled HTML that happens to pass `toBeVisible()`.

---

## Phase 5 — Vercel Blob File Upload (in progress)

**What did I decide?**
Validation runs twice: once client-side in `DocumentUploadZone` for instant feedback, and once server-side in the Server Action before anything touches the database or Blob. The client check is UX. The server check is security. Never trust client-side validation alone.

The `file_key` column stores the Blob pathname, not the full URL. Full URLs change when a Blob store migrates or is recreated. Pathnames are stable. Signed URLs are generated fresh on every file access request via `/api/documents/[documentId]/file`.

Chose to keep the Document record even when upload fails — `status: failed`, never deleted. This gives the coordinator a visible failure state to retry from, and preserves the audit trail of what was attempted.

Blob store created as **private** in Vercel's Mumbai (BOM1) region. Private means no URL gives access without a valid signed token. Mumbai because the patients and coordinators are in India — latency matters when a coordinator is uploading a document on a hospital Wi-Fi connection.

**What resisted me?**
Getting `BLOB_READ_WRITE_TOKEN` out of Vercel. Sensitive env vars cannot be retrieved once set — not via the CLI, not via the dashboard edit field. The only path is to create a new token and update the env var. Vercel's security model is intentional: a token you can retrieve is a token that can be stolen from your CI logs or your terminal history.

**What did I understand?**
Rate limiting is not about preventing abuse. It is about preventing accidents. A coordinator who accidentally triggers an upload loop — or a bug that does it for them — should not generate $200 in Claude API costs before anyone notices. 10 uploads per hour per user is generous for legitimate use and a hard stop for anything that goes wrong.

---

## Phase 5 + Enforcement — Zod schemas, form contract, lint gates, hooks

**What did I decide?**

Rules need a feedback loop, not just a location. A rule in a doc gets read once. A lint script you have to remember to run fails silently when forgotten. So we put each rule in three places: a lint script (CI + manual), a `PostToolUse` hook (fires the moment you write the file), and `CLAUDE.md` (session start). Same rule, three feedback loops — each catching the failure the others miss. That's progressive disclosure of constraints: the right rule at the right moment, not everything upfront.

`CLAUDE.md` was 330 lines. Most of it was pattern detail — form contract code examples, enum tables, env var lists — loaded on every turn regardless of what was being built. Cut it to 235 lines by moving detail to `docs/` and keeping only what causes a silent production bug if missed on the first line of a new session.

**What resisted me?**

Writing the lint scripts exposed a false positive immediately: `upload-document.ts` calls `validateDocumentFile()` which wraps the Zod schema internally — but the script only checked for a direct schema import and flagged it as non-compliant. The fix was straightforward. The lesson wasn't: proxy validators that satisfy a rule indirectly are easy to miss when you're writing enforcement logic. You have to think about the intent of the rule, not just its surface pattern.

**What did I understand?**

The gap between "I documented this" and "this cannot happen" is where bugs live. Documentation is not enforcement. The question for every rule: at what point in the workflow does violating it become impossible to miss?

---

## Phase 6 Pre-work — Schema Hardening + Upload Hints

**What did I decide?**

Three decisions, all made before writing a line of Phase 6 AI pipeline code.

**1. Self-describing tables.** `document_actions` and `pending_tasks` are two different things — audit trail vs. working list — but they need to carry the same categorical metadata independently. Added `category` and `phase_appears` to `document_actions`, and `action_for` to `pending_tasks`. This means either table can be queried without a join for basic product questions ("what actions were taken for this document?", "which tasks are assigned to the patient?"). The `source_action_id` FK on `pending_tasks` preserves the lineage without coupling the tables for reads.

The alternative was to keep only `pending_tasks` (simpler schema, fewer tables) and derive everything from there. The objection to that: when a document is archived and its tasks are deleted or completed, you lose the audit trail of what Claude extracted from that document. `document_actions` is the immutable record of what was in each file. `pending_tasks` is the coordinator's working list. These are different things and need different tables.

**2. Custom document type via `purpose` field.** When a coordinator selects "Other (custom)" in the upload UI, the custom label is stored in the `purpose` column, not a new `custom_type` column. `type` stays `'other'`. This keeps the enum clean and avoids schema changes for what is ultimately display metadata. The coordinator or Claude can later replace the purpose with a real clinical description.

**3. Parallel input model for upload hints.** Coordinator provides optional hints (type, hospital) before uploading. Hints are seeded into the `documents` row immediately so the UI has something to show while AI runs. Claude then classifies independently — if it disagrees, Claude wins. The coordinator can correct any discrepancy via `DocumentClassificationEditor` after classification. This is the same UX pattern Eka Care uses at upload time.

The alternative was to skip classification when a hint was provided ("trust the coordinator"). Rejected: a coordinator who selects "Lab Report" and uploads a bill causes downstream errors in translation and task generation. Claude reading the actual document is not optional.

**What resisted me?**

The schema review conversation. Every time we looked at the tables, a new gap appeared — `category` missing from `document_actions`, `action_for` missing from `pending_tasks`, hints not yet anywhere in the schema. Each gap on its own looked small. What resisted was accepting that the right move was to stop, enumerate all the gaps at once, and fix the schema before touching any AI code. The pull to just start writing `classify.ts` was strong.

The structural review turned up the right question: "can I answer basic product questions from a single table, or do I need joins for everything?" When the answer was "joins for everything" on both tables, the schema wasn't done yet.

**What did I understand?**

The difference between a schema that is structurally correct and one that is query-practical. Normalization tells you not to repeat data. But a medical product where you need to surface "what did Claude extract from this document?" and "what is the coordinator's current task list?" in different UI contexts benefits from deliberate denormalization — each table carries enough to answer its own most common question.

Upload hints also made me understand the value of showing something immediately vs. showing nothing until AI runs. The hint-seeding pattern (write hint to DB → show in UI → AI runs → UI updates) is a small UX detail but it changes whether the product feels responsive or dead while a 3-second Claude call runs.

**One thing that surprised me:**

The `purpose` field as a dual-use column. It was designed to hold Claude's plain-language purpose description ("Pre-operation blood work"). It turns out it also works perfectly as the custom type label when `type='other'`. The field has exactly the right semantics — a human-readable description of what this document is — regardless of whether Claude or the coordinator wrote it.

---

## Phase 6 — AI Pipeline + Type Enforcement

**What did I decide?**

Three decisions, made in sequence as the problems surfaced.

**1. Verified the AI SDK against installed node_modules, not docs.**
The subagent research returned code using `generateObject` and `mimeType` on `FilePart`. Both were wrong for the installed `ai@6.0.198` — `generateObject` is `@deprecated`, and the field is `mediaType` not `mimeType`. Neither produces a TypeScript error that's immediately obvious; `generateObject` still compiles with a deprecation warning, and the wrong field name would only surface at runtime. The decision: before writing any AI SDK call, read the installed package types directly from `node_modules`. The installed package is always ground truth. Web docs and training data are not.

The correct pattern:
```ts
const result = await generateText({
  model: anthropic(AI_MODELS.classify),
  output: Output.object({ schema: ClassificationSchema }),
  messages: [{ role: 'user', content: [
    { type: 'text', text: prompt },
    { type: 'file', data: fileBuffer, mediaType: mimeType },
  ]}],
})
if (result.output === undefined) throw new NoOutputGeneratedError()
return result.output
```

**2. `name_is_guessed` as an explicit boolean in the classification schema.**
The first version of the classification prompt said "use the exact name if visible, otherwise infer a descriptive fallback." That hid the inference behind a clean name — the coordinator and the audit trail had no way to know if Claude read the name or made it up. Added `name_is_guessed: boolean` to `ClassificationSchema` and stored `[Inferred]` as a prefix in the DB when true. Accuracy in health records is non-negotiable. Guesses have to be labelled.

**3. Unreadable document returns an explicit failure signal, not silent best-guesses.**
The original prompt's fallback behaviour was "classify as other and do your best." That means a document that is a blurred photograph of a prescription could come back as `type: "other"`, `suggested_purpose: "Medication instructions"` — which looks like a successful classification but is fabricated. Changed the rule: if the document is unreadable or corrupt, return `suggested_purpose: "Document unreadable — please re-upload a clearer scan"` and null everything else. No fabrication. Silent best-guesses on health documents cause real harm downstream.

**4. Single source of truth for all DB-aligned union types.**
Ten-plus files each had slightly different inline definitions of the same types — `DocumentType`, `EpisodeStatus`, `TaskCategory`, etc. They were close enough to not cause obvious errors, but far enough to drift when a DB enum changes. Created `lib/types/domain.ts` as the single owner; all components, actions, and AI schemas import from there, never redefine. The check is machine-backed: `pnpm lint:types` (`scripts/check-types.mjs`) fails CI on any inline redefinition. A `PostToolUse` hook fires the same warning the moment a file is written.

**What resisted me?**

The subagent research produced confident, syntactically valid code with two silent bugs. This is the hard version of "garbage in, garbage out" — the input wasn't obviously wrong, and the output wasn't obviously broken. The resistance was accepting that the only safe path is to verify the API surface directly from the installed source, every time, before writing a single call. The temptation to trust a well-structured response from an AI that sounds authoritative is real.

The type audit also resisted. Once the first duplicate definition was found, the instinct was to fix that one and move on. What actually had to happen was stopping, enumerating every file that could have an inline type definition, and fixing all of them at once — because partial cleanup leaves the codebase in a state where the rule is enforced in some files but not others, which is worse than no rule at all.

**What did I understand?**

The difference between a lint rule and an enforcement layer. A rule written in a doc gets read once. A lint script you have to remember to run fails silently when forgotten. A `PostToolUse` hook fires the moment you write the file — before the context window has scrolled past the decision. The same rule in three places (doc, CI script, inline hook) doesn't mean the rule is written three times. It means the feedback arrives at three different points in the workflow, each catching what the others miss.

**One thing that surprised me:**

The `check-types.mjs` script caught a false positive on its own first run: `lib/validation/schemas.ts` defines `DOCUMENT_TYPES` as an `as const` array, which the regex read as a type definition. The fix was a one-line exemption. But the false positive was useful: it proved the script was actually scanning the right files with the right pattern. A lint script that never fires is indistinguishable from one that has a bug. The false positive was evidence the tool was working.

---

## Phase 7 — Coordinator Dashboard Display

**What did I decide?**

Two decisions, made in sequence.

**1. Data Access Layer (DAL) over inline page fetchers.**
The first version of the coordinator dashboard page had three private async functions at the bottom — `fetchEpisodeDocuments`, `fetchEpisodeSummary`, `fetchOpenTaskCounts` — each taking a shared Supabase client as a parameter. It worked, but it meant the coordinator page owned all the data logic, and the patient page (Phase 8) would have to duplicate it. The decision: extract to `lib/dal/` with `import 'server-only'` and React `cache()` on every function. Each function owns its own Supabase client. The page becomes three import lines and one `Promise.all`. When the patient page needs the same data, it's the same import — no duplication, no drift.

The alternative was to keep fetchers in the page files and accept the duplication. Rejected because the DAL pattern also removes an easy-to-miss mistake: passing a stale Supabase client across functions that have different session contexts.

**2. `EpisodeTimeline` as a client component receiving data as props, not fetching it.**
The timeline needs to manage `selectedId` state (which document card is open in the sheet). That means `'use client'`. The question was whether it should also fetch its own data via a server action or prop. Chose props: the RSC page fetches everything, passes it down. The component is pure UI — state + rendering, no network calls. This also makes stories trivial (pass fixture data, no mocking required) and keeps the component testable in isolation.

**What resisted me?**

The Supabase nested select for `documents → document_translations → document_actions` returns the joined rows differently depending on cardinality — sometimes an array, sometimes a single object, sometimes null. The mapping code had to handle all three cases with `Array.isArray()` checks. The shape is not documented clearly; it had to be inferred from what actually came back.

**What did I understand?**

`React.cache()` is not the same as HTTP caching or `unstable_cache`. It deduplicates identical function calls within a single request — if the coordinator dashboard and a layout component both call `getActiveEpisode(patientId)` with the same argument, Supabase is only hit once. The cost is zero. The benefit is that you can call DAL functions freely across RSC components without worrying about over-fetching.

---

## Phase 8 — Patient View

**What did I decide?**

**1. `what_it_means` visible to patients.**
The spec said "patient sees `plain_language` only." After looking at the actual content Claude generates, `what_it_means` is clinically useful context — it explains the significance of the document, not just what it says. Hiding it from patients makes the experience thinner without a real privacy or safety justification. Coordinator-only information is the *actions* section (task assignments, operational next steps). Plain language + what it means = what a patient needs to understand their own care.

**2. `PatientSummaryPanel` as a separate component from `EpisodeSummaryPanel`.**
The coordinator's episode summary panel shows: status badge, task counts, visit purpose, timeline summary. The patient's panel should show: plain-language status sentence, visit purpose, timeline summary. Same data, different framing. Rather than adding `viewerRole` conditionals inside `EpisodeSummaryPanel`, created a separate `PatientSummaryPanel`. The coordinator and patient views will diverge further as the product grows — a shared component with role-branching becomes harder to reason about at each branch. Two components, each with one job.

**What resisted me?**

The proxy redirect loop. After patient login, the auth action redirects to `/dashboard`. The proxy sees a patient on `/dashboard`, looks up their `patient_access` row, and redirects to `/patient/[id]`. This should work — but the first implementation of the proxy Rule 2 extracted `patientId` from `pathname.split('/')[2]`, which is `undefined` for `/dashboard` (no segment at index 2). The result was a redirect to `/patient/undefined`, which the proxy then had no rule for, which passed through to a 404. The loop was silent — no error, just the browser spinning.

The fix required two changes: the proxy Rule 2 now queries `patient_access` when `patientId` is missing from the URL, and the auth action now does the same lookup post-login and redirects patients directly to `/patient/[id]` instead of always going to `/dashboard`.

**What did I understand?**

Smoke testing with Playwright caught a UX issue that unit tests and type checking cannot: the empty state message in `EpisodeTimeline` said "upload the first one above" — which is meaningless and confusing to a patient who has no upload capability. The automated test found it because it checked the actual rendered text. The fix is one conditional, but finding it required running the thing in a browser as the actual user.

The deeper lesson: role-aware empty states are as important as role-aware data. A page that correctly hides coordinator data but shows coordinator-oriented copy is still broken from the patient's perspective.

**One thing that surprised me:**

The patient account setup exposed that the Supabase project had no patient auth user at all — only a coordinator and a patient *record*. The patient record (the medical subject) and the patient auth user (the person who logs in) are two different things linked by `patient_access`. It is easy to create one without the other. The data model is correct — but the seed data has to explicitly create both and link them, or the patient view can never be tested end-to-end.

---

## Phase 9 — Pending Tasks Page

**What did I decide?**

**1. Inline confirm banner instead of an `AlertDialog` modal.**
The spec called for a confirm dialog before marking a task as resolved. The natural choice was `AlertDialog` from Shadcn — but `alert-dialog` wasn't installed, and the decision was whether to add a new primitive or work with what exists. Chose an inline confirm banner (a row appearing between the task list and the page footer) instead. It requires no new Shadcn component, stays in the same scroll context as the task, and is harder to accidentally dismiss (no escape/click-outside). The modal is technically "correct" UX pattern, but the inline banner is safer for a high-stakes action where accidental confirmation matters.

**2. Optimistic resolve with automatic rollback on failure.**
When the coordinator clicks "Mark as done", the UI immediately applies strikethrough (optimistic update via a local `Set<string>`). The server action runs in the background via `useTransition`. If the server action returns `ok: false`, the `Set` entry is deleted and the strikethrough reverts. This means the UI never blocks on the network call, but also never lies permanently. The alternative (wait for server confirmation before updating) creates a sluggish feel for what should be an instant action — especially on a hospital Wi-Fi connection.

**3. `view toggle` persistence via `localStorage` only.**
View preference (list vs card) is saved to `localStorage` rather than the database. It is purely a display preference, not data — it has no impact on any other user, is ephemeral per device, and adding a DB column for it would be over-engineering. The default is `list`. localStorage is read in a `useEffect` after mount, so the initial render always shows list view (SSR-safe, no hydration mismatch).

**What resisted me?**

The Vitest test cascade from Vite dependency optimization. Adding `next/link` to `EpisodeSummaryPanel` (which needed it for the "View all tasks" link) caused the Vite optimizer to invalidate its cache mid-test-run — this kills active connections to the `axe-core` chunk, which causes all simultaneously-running Storybook stories to fail with a fetch error. The fix: add `next/link` to `optimizeDeps.include` in `vitest.config.ts` so Vite bundles it upfront rather than discovering it lazily during a test run. The second problem: the `ResolveFlow` story assumed list view was active, but `localStorage` could persist `card` from a prior story. Fix: click the list view button explicitly at the start of that story's `play` function.

**What did I understand?**

The difference between `server-only` import errors and RLS enforcement. Both prevent unauthorized data access, but at different layers. `server-only` throws a build error if a DAL file is imported client-side — it makes the wrong pattern physically impossible. RLS throws a runtime database error if a query violates access policies — it makes the wrong pattern fail safely. The combination means: the wrong import path doesn't compile, and even if it did, the database query would be rejected. Defense in depth is not paranoia. It is the difference between "this should not happen" and "this cannot happen."

---

## Phase 11 — UX Polish

**What did I decide?**

**1. Bottom tab navigation via a nested RSC layout, not individual pages.**
Adding `app/(coordinator)/dashboard/[patientId]/layout.tsx` wraps both the overview and tasks pages without touching either page. The `PatientTabNav` client component gets `patientId` from the layout (RSC) and uses `usePathname()` for active state. This is cleaner than repeating nav in each page — one layout change covers all current and future sub-routes.

**2. Progress steps for the patient null state instead of a pulsing skeleton.**
The patient arrives having handed over their medical documents to a coordinator they may not fully trust yet. A loading skeleton communicates "something is happening" without explaining what. Three explicit steps — episode open ✓, coordinator reviewing ↻, summary coming soon ○ — tell the patient exactly where they are in the process and set expectations. The anxiety management principle from MyChart research: the UX must immediately signal that the patient is in the right place and someone is working for them.

**3. `what_it_means` gets a tinted background box, not just a section header.**
Both sections had the same visual weight — grey uppercase label + paragraph. A reader scanning the translation panel couldn't immediately tell where "what the document says" ended and "what this means for you" began. The `bg-muted/50` tinted box creates a clear break without adding a Separator or changing the layout.

**4. Patient EpisodeTimeline filters to translated-only.**
Showing pending/failed doc states to patients adds anxiety without utility. A patient seeing "Failed — tap to retry" has no ability to act on it and no context for what failed. Only `translated` documents surface in the patient timeline. The coordinator still sees everything.

**What resisted me?**

`usePathname()` returns `null` in Storybook (no Next.js router context). The worktree agent wrote `pathname.endsWith('/tasks')` which throws on null. Fix: `(pathname ?? '').endsWith('/tasks')`. The pattern is standard for any component that reads router state in stories — always guard against null from `usePathname`.

The git worktree left by the subagent was picked up by Vitest as a new test root, causing an unrelated test from the worktree's `__tests__/` to appear in the main suite and fail. Removed the worktree after copying files.

**What did I understand?**

Healthcare UX research consistently surfaces one principle that V1 implementations miss: the empty state is not a loading state — it is a communication moment. A patient landing on a page with skeleton bars and generic copy is not reassured; they're confused. The progress steps pattern (done / in-progress / pending) is borrowed from package tracking and works for exactly the same reason: it tells users where they are in a process they cannot control.

---

## Phase 10 — Episode Status Management

**What did I decide?**

**1. `EpisodeStatusManager` as a separate feature component, not embedded in `EpisodeSummaryPanel`.**
The `EpisodeSummaryPanel` is display-only — it renders the AI-generated summary, task counts, and status badge. Adding a status transition control inside it would mix display and action concerns in the same component. A separate `EpisodeStatusManager` card sits below the summary panel and owns the transition UI entirely. This also means the composite `EpisodeStatusCard` stays dumb (no action injection needed) and the feature boundary is clean.

**2. Inline confirm pattern, same as resolve-task.**
The confirm step shows what the transition means in plain language before the coordinator commits ("The patient has been medically cleared and is ready for discharge. Post-discharge tasks will become visible."). Same inline banner pattern as task resolution — no new Shadcn components, same mental model for the coordinator.

**3. `defaultShowPostDischarge` prop on `TasksClient`, not episode-status-aware logic inside the component.**
When an episode is `care_complete` or `closed`, the tasks page should show post-discharge tasks by default. The RSC page knows the episode status and passes `defaultShowPostDischarge={true}` when appropriate. The component stays stateless about episode lifecycle — it just takes a default. This keeps the component reusable and the RSC page as the single source of truth for what state the data is in.

**What resisted me?**

A Storybook cross-test pollution: the `EpisodeStatusManager Closed` story failed due to an unhandled error from `TasksClient` completing an async transition after its own story had ended. The fix was two-pronged: add optional chaining (`result?.ok`) to guard against the mock returning `undefined` between story transitions, and fix a case-sensitive regex mismatch in the `Closed` story assertion (`/no further changes/` → `/no further changes/i`).

**What did I understand?**

Transition validation belongs in the server action, not the Zod schema. The schema validates shape (is `newStatus` one of the valid enum values?). The action validates semantics (is this transition legal from the current DB state?). Putting the `VALID_EPISODE_TRANSITIONS` map in the schema file and importing it into the action keeps the transition rules in one place while keeping the schema focused on shape validation.

---

## ESLint Migration — Architecture Enforcement Overhaul

**What did I decide?**

**Drop the three regex scripts entirely; move everything into ESLint.**
`check-primitives.mjs`, `check-schemas.mjs`, and `check-types.mjs` were replaced by five custom AST rules in `eslint.config.mjs` under the `carealig/` plugin namespace. `check-stories.mjs` stays — it's a filesystem existence check that ESLint can't do per-file. The trigger for this was a multiline `<button\n  onClick=...` tag that passed the regex but violated the primitive rule. The decision was not to patch the regex, but to eliminate the class of problem: regex applied to source text is permanently second-class to AST analysis.

Additional standard rules added: `@typescript-eslint/no-unused-vars` (caught the dead `episodePhase` prop class), `no-floating-promises` (caught silent async fire-and-forget), `react-hooks/exhaustive-deps`, `consistent-type-imports`.

**Pre-commit hook via `.githooks/`**, not Husky. No extra runtime dependency. Activated by `git config core.hooksPath .githooks` (auto-runs via `prepare` script on `pnpm install`). Runs `tsc + eslint + check-stories` before every commit — the same sequence as `pnpm lint:arch`.

**What resisted me?**

`eslint-config-next` already registers `@typescript-eslint` as a plugin. Importing and redeclaring it in the same flat config throws a "Cannot redefine plugin" error. Resolution: add rules in a separate config block without re-declaring the plugin — ESLint v9 flat config merges plugin registrations from earlier array entries automatically. `no-floating-promises` also requires `parserOptions.project` for typed linting; adding that to the config block resolved it.

**What did I understand?**

The bugs ESLint found while the codebase was being "enforced" by the old scripts: an unused import in `upload-document.ts` (`getSignedBlobUrl` — dead since the signed URL API moved to the route handler), floating promises on `handleFile()` calls in `DocumentUploadZone` (fire-and-forget errors were silently swallowed), and `setState` inside a `useEffect` for localStorage (correct behaviour, wrong pattern — moved to lazy state initializer). These weren't new bugs introduced in Phase 9. They were pre-existing. The old scripts never saw them because they didn't look for them.

---

## Phase 12 — Upload Progress Indication, AI Pipeline Debugging, and Observability

**What did I decide?**

**1. Timer-based stage progression instead of a real-time server stream.**
The upload pipeline runs synchronously in a single server action — blob upload → classify → translate → summarise. There is no way to push stage updates to the client without restructuring the entire pipeline into streaming or polling. The decision was to estimate: four named stages with hard-coded start thresholds (0s, 4s, 12s, 22s) derived from real timing observations. This shows the coordinator what the pipeline is doing without any backend changes. The alternative was an indeterminate spinner with no context — which was the complaint that triggered this work.

**2. State reset from the event handler, not the effect.**
The interval for elapsed-second tracking starts in a `useEffect`. The natural pattern is also to reset elapsed to 0 in the same effect when upload status ends. ESLint's `react-hooks/set-state-in-effect` rule blocks this — calling `setState` synchronously in the effect body causes cascading renders. Moving the reset to `handleFile()` (the event handler that triggers the upload) is actually the correct pattern: the reset is part of the event, not a reaction to state change.

**3. Observability before fixes — switch to plain `generateText` to expose what the model actually returned.**
After two hypothesis-driven fixes both failed (see "What resisted me"), the decision was to stop guessing and add observability first. The specific change: remove `Output.object()` temporarily and use plain `generateText` so `result.text` — the raw model output — is always accessible for logging. This immediately produced logs showing exactly what the model returned, which field failed validation, and why. Once the real cause was diagnosed, the approach was restored to `Output.object()` (the Vercel-recommended pattern) with a targeted catch block that reads the raw text from the error object's `.text` property.

**4. `Output.object()` restored with error-level observability via `NoObjectGeneratedError.text`.**
`Output.object()` is the correct pattern per the Vercel AI SDK docs — it handles JSON extraction and Zod validation automatically and returns a fully-typed result. The final implementation keeps `Output.object()` and wraps the `generateText` call in a try-catch. When `Output.object()` fails, it internally throws `NoObjectGeneratedError` (not the public `NoOutputGeneratedError`) — and that error carries a `.text` property containing the raw model output. We read it without importing the deprecated class (ESLint only checks import specifiers, not property access). This gives the SDK's clean abstraction on the success path and full diagnostic information on any failure path.

**5. `description` field added to the translate prompt — the actual root cause.**
The translate prompt listed three of the four required fields for each action object (`action_for`, `category`, `phase_appears`) and silently omitted `description`. The model followed the prompt literally and omitted the field. The JSON was valid; the schema validation failed. This is what every prior fix had missed — not because the model or the SDK was broken, but because the prompt was incomplete.

**6. Unapplied migration surfaced by the pipeline succeeding.**
Once translation worked, two new DB insert errors appeared: `"Could not find the 'category' column of 'document_actions' in the schema cache"` and `"Could not find the 'action_for' column of 'pending_tasks' in the schema cache"`. The migration `20240105000000_action_classification_columns.sql` — written in Phase 6 pre-work to add these columns — had never been applied to the live Supabase project. The local schema and the remote schema had drifted silently. Fix: `pnpm supabase db push`, which applied the single pending migration and resolved both insert failures. `supabase` is a project dev dependency, not a globally installed CLI — running it via `pnpm supabase` rather than bare `supabase` is the correct invocation.

**What resisted me?**

**The translation failure produced three consecutive wrong fixes before the right one.**

This is worth documenting in full because the pattern — confident diagnosis, applied fix, same failure — is common when working at the boundary between application code and AI model behaviour.

**Wrong fix 1 — prompt wording and temperature.**
First hypothesis: the model wasn't told to return JSON, and temperature 0.1 was adding randomness. Added "Return structured JSON only. No preamble." and set temperature to 0. Rational guess. Didn't fix it. The upload still failed with "Invalid JSON response" on the next attempt.

**Wrong fix 2 — missing enum values in the prompt.**
Second hypothesis: the model was guessing enum values it hadn't been told. Added the full list of valid `category` and `phase_appears` values to the prompt. Also rational. Also didn't fix the core issue. The model was already producing valid JSON — the enum values were not the problem.

Neither fix was wrong in isolation — both improvements belong in the prompt. But neither addressed the actual failure, because neither fix was based on evidence of what the model was actually returning. Both were based on reasoning about what might be wrong.

**Why `Output.object()` hid the evidence.**
When `Output.object()` fails — whether from a JSON parse error or a Zod validation failure — it throws immediately before returning the result object. `result.text`, which holds the raw model output, is not accessible in a catch block. The error message "Invalid JSON response" was the only information available, and it was misleading: it implied a JSON syntax failure, when the actual failure was a schema validation failure on valid JSON.

**The observability switch — what it revealed.**
Replacing `Output.object()` with plain `generateText` made `result.text` always available. Immediately, the logs showed:

```
hadCodeFences: false          ← not a code fence issue
length: 1084                  ← model returned a full response
preview: { "plain_language": "..."  ← valid JSON, correct structure
```

And then: `Zod validation failed: actions.0.description: Invalid input: expected string, received undefined`

The model returned valid JSON. The enum values were correct. The field `description` was simply absent from every action object — because the prompt never mentioned it.

**The model tier effect — tool calling availability is the real difference, not prompt-following quality.**
The development model is `google/gemma-4-31b-it:free` via OpenRouter. The production model is `claude-haiku-4-5-20251001` via Anthropic. The difference that actually matters is not how well each model follows instructions — it is what mechanism `Output.object()` uses under the hood with each.

With **Anthropic**, `Output.object()` uses **tool calling**. The schema is sent to the API as a tool definition. The model is forced to respond by invoking that tool with arguments that match the schema. The JSON is structurally guaranteed before it ever reaches the AI SDK's parsing layer. A missing field is impossible — the API enforces it at generation time, not at validation time.

With **Gemma via OpenRouter**, tool calling is not available. `Output.object()` falls back to **prompt-based JSON extraction**: it adds a JSON instruction to the prompt and then tries to parse whatever text the model returns. The schema is a hint, not a constraint. A missing field is entirely possible — the model produces what the prompt describes, and if the prompt doesn't describe `description`, the field doesn't appear.

This is why classification worked and translation failed with the same `Output.object()` call. Classification uses a flat schema with simple scalar fields — easier to produce correctly from prompt alone. Translation uses a nested array of action objects each requiring four specific fields with constrained enum values — more surface area for prompt-based extraction to miss. The tool calling gap widened exactly at the point of maximum schema complexity.

The implication reaches further than just prompting. `Output.object()` is the correct production pattern precisely because in production, with Anthropic, it provides schema enforcement at the API level. In development with a free model, the same API call degrades silently to prompt-based extraction with no enforcement at all. The abstraction looks identical on both sides; the behaviour is fundamentally different. This makes the dev/prod model gap not just a matter of output quality but a matter of which reliability guarantees are actually in effect.

Prompts must be complete enough to work when tool calling is unavailable and the model is the only enforcement layer. That is the hardest version of the constraint.

**The `onFinish` hook investigation — and why it wouldn't have worked.**
The initial restoration plan was to use `generateText`'s `onFinish` callback as the observability hook — it fires when the model finishes generating, and receives the raw text. After checking the AI SDK source in `node_modules`, this turned out to be wrong: `onFinish` is called after `parseCompleteOutput` runs. If `Output.object()` throws during parsing, `onFinish` is never called. The evidence was already in the error object — `NoObjectGeneratedError` has a `.text` property — but reading the source was the only way to know that. The assumption that `onFinish` was the right hook was itself a guess; verifying it against `node_modules` (the same principle from Phase 6) changed the implementation.

**Three ESLint violations on a single component — caught in seconds, not hours.**
The progress indicator in `DocumentUploadZone` required three attempts to get past `pnpm lint:arch`, each violation teaching something different about the React rendering model:

Attempt 1 — `setElapsed(0)` inside `useEffect` body → `react-hooks/set-state-in-effect`. Synchronous setState in an effect body triggers cascading renders.

Attempt 2 — Replace with a ref (`uploadStartRef.current = Date.now()`) and compute elapsed in render → `react-hooks/refs`. Refs are mutable but not watched — reading them in render produces a component that renders once and silently freezes. And on the same line: `Date.now()` in render → `react-hooks/purity`. Components must be pure functions; `Date.now()` makes the same inputs produce different outputs across renders.

Final solution — `elapsed` state, reset from the event handler (`handleFile`), incremented via interval callback. The effect only starts and stops the interval; it writes nothing directly.

These violations were caught by the `PostToolUse` hook firing `pnpm lint:arch` automatically the moment each file was written. Not at a phase exit gate. Not by the developer noticing. Seconds after the code existed.

**The unapplied migration was invisible until the pipeline succeeded.**
The `document_actions` and `pending_tasks` insert failures (`"Could not find the 'category' column"`, `"Could not find the 'action_for' column"`) were logged as warnings — pipeline continued, episode summary still generated. The upload appeared to succeed from the user's perspective. The DB inserts for the AI-extracted actions were silently dropped. This kind of silent data loss is exactly what the "continue on non-fatal error" pattern is supposed to surface in logs rather than hide — and it did. But it only became visible once the translation itself was working. While translation was failing, the insert errors were never reached.

**What did I understand?**

**Three detection layers, three classes of bug, no overlap between them.**

Static analysis (`pnpm lint:arch`, `tsc`, ESLint) catches code structure violations — wrong React patterns, type errors, deprecated API usage. Tests catch logic errors — the component does what it's supposed to do given known inputs. Runtime usage catches AI behaviour — whether the model follows the prompt. Each layer is necessary. None is sufficient. The three ESLint violations in the progress component would never have appeared in any test. The missing `description` field in the prompt would never have appeared in ESLint. The unapplied migration would never have appeared until the pipeline that writes to those columns actually ran.

**`Output.object()` uses one error class for two structurally different failure modes.**
`NoObjectGeneratedError` is thrown in two distinct situations: when `JSON.parse` fails on the model's response text (actual invalid JSON — syntax error), and when the JSON parses successfully but fails Zod schema validation (valid JSON, wrong shape). Both cases produce the same error class, and the default surface message for both is "Invalid JSON response." This is the structural reason the error was misleading — it was not merely uninformative, it was actively pointing at the wrong failure mode. The actual failure was a schema validation error on valid JSON. The error message implied a syntax error. Two rounds of diagnosis followed from that mismatch.

**`Output.object()` has an internal automatic retry mechanism — and its disappearance was a signal.**
The first upload failure logged `"Failed after 3 attempts. Last error: Invalid JSON response"`. The second upload failure (after wrong fix 1) logged just `"Invalid JSON response"` with no retry prefix. That change was not random. `Output.object()` retries automatically on certain failure types — giving the model another chance before surfacing the error. When the retry prefix disappeared after the prompt change, it indicated the error type had changed in some way the SDK's retry logic treats differently. We did not read this signal during debugging. Had we noticed it, it would have told us the failure mode was shifting even when the visible error message looked identical.

**`NoOutputGeneratedError` (public API) and `NoObjectGeneratedError` (internal) are different classes with different properties.**
The Vercel AI SDK's public API deprecates `NoObjectGeneratedError` in favour of `NoOutputGeneratedError` — our ESLint rule flags any import of the old class. But `Output.object()` internally throws `NoObjectGeneratedError` to this day, and it is `NoObjectGeneratedError` that carries the `.text` property with the raw model output. `NoOutputGeneratedError` — the public replacement — does not have `.text`. The asymmetry between the public naming and the internal implementation is what made the catch block work: we access `(err as { text?: string }).text` without importing the deprecated class. ESLint only enforces at import declaration level; property access on a caught error is not flagged. The raw text was always in the thrown error — it was accessible all along without switching away from `Output.object()`. We just didn't know to look there, and we couldn't have known without reading the `node_modules` source directly.

**The cost of a misleading error message.**
"Invalid JSON response" from `Output.object()` is not wrong — it is what the SDK calls both parsing and validation failures under the same name. But it costs multiple rounds of diagnosis because it implies a different problem than what actually happened. The lesson is not that SDK error messages should be more precise (they cannot anticipate every downstream failure mode). The lesson is that any AI pipeline step needs logging of the raw model output on failure — regardless of what abstraction layer sits above it. That information has to be captured before the abstraction throws, because after it throws, only the error message remains.

**The dev/prod model gap is a testing gap, not a configuration gap.**
Switching the dev model to a free OpenRouter model was the right cost decision. But it created a hidden assumption: that a prompt sufficient for Anthropic is sufficient for any model. It isn't. The right principle: prompts must be complete enough to work with a model that follows instructions literally and has no training-data familiarity with your schema. If a prompt relies on the model inferring what wasn't said, it will fail with the wrong model — and the failure will look like an SDK or infrastructure problem before it looks like a prompt problem.

**Schema drift between local migrations and remote DB is silent until the affected code runs.**
The migration existed. The SQL was correct. The migration had simply never been pushed. There is no compile-time check for this, no type error, no lint violation. The only thing that surfaces it is running the pipeline against a real database. In production, this kind of drift causes silent data loss — the insert fails, the error is logged, the pipeline continues, and the coordinator never sees the tasks that Claude extracted from their patient's document. The fix is one command (`pnpm supabase db push`), but the detection requires actually running the thing.

---

## Phase 13 — Loading States

**Commit:** (see git log)

**What did I decide?**
Added `loading.tsx` skeleton screens to all four async RSC routes: the coordinator patient list, the coordinator patient detail page, the tasks page, and the patient view. The decision was between adding loading skeletons now versus deferring until after deployment. Chose now — a page that shows nothing for one to two seconds while data loads is noticeably worse for a user who is already under stress in a hospital setting. The skeletons are cheap to write and directly serve the product quality bar.

The audit also confirmed that all empty states were already present and correct: no patients, no active episode, no documents, no tasks, all tasks resolved, no episode summary — every zero-state had copy. Loading and empty states are different problems. Loading is about the time between request and data. Empty is about what happens when the data is zero. Both need to be handled, and they were being conflated. Clarifying that distinction let the audit go faster.

**What resisted me?**
Nothing technically difficult. The friction was recognising that the empty states were already done and not doubling the work. The temptation was to rewrite them anyway on the grounds that consistency might be lacking. Resisted it — the audit showed they were fine, and rewriting working code for aesthetic reasons is waste.

**What did I understand?**
Next.js `loading.tsx` files work via React Suspense at the segment level. The layout renders immediately; the loading skeleton shows while the page component awaits its data fetches. This means the header and navigation are interactive from the first paint — only the page body is deferred. The user sees structure instantly. The skeleton matches the shape of the content that will replace it, so the layout does not shift when the data arrives. The skeleton is not a progress indicator — it is a shape promise.

---

## Design System, Logo, and UX Direction — Session 2026-06-15

**What did I decide?**

Six decisions made in sequence, each building on the previous.

**1. Brand color — deep teal as primary.**
The app had zero chroma: every CSS token was `oklch(X 0 0)`. Chose brand teal `oklch(0.44 0.11 183)` — warmer and slightly greener than hospital teal, not clinical, not cold. Set `--primary: var(--brand-base)` so all existing Shadcn buttons, focus rings, and input borders inherited the brand color automatically with zero component changes. Warm cream `oklch(0.99 0.006 90)` background instead of pure white. Radius bumped to 0.75rem (warmer, more approachable). Added Plus Jakarta Sans (headings) alongside Geist (body). Two-font system: display warmth + UI legibility.

**2. Token naming convention — `base/on/tint/border/surface` suffix system.**
Initial names (`--brand`, `--brand-subtle`, `--brand-muted`) were fine for V1 but not theme-scalable. Renamed to suffix convention: `--brand-base` (solid fill), `--brand-on` (text on brand), `--brand-tint` (light wash bg), `--brand-border` (borders), `--patient-surface` (page-level bg). Any future role (doctor, admin) adds `--doctor-base/on/tint/border/surface`. Any future theme redefines `--brand-*` under `[data-theme="x"]` with no component changes. Enforcement via `carealig/no-raw-color-values` ESLint rule — blocks all `oklch()`/`#hex`/`rgb()` in className or style props. Exception: `eslint-disable-next-line` with written justification.

**3. Logo — Mark A (arc + arrow direction C variant).**
Three flat mark directions and one 3D clay app icon family were explored. Chose Mark A: open arc (three-quarters circle) with a directional arrow at the open end. Simultaneously reads as the letter C (Care) and a direction marker (Align). The arrow points outward/upward — care moving toward resolution. Wordmark: "Care" in brand teal, "Align" in near-black, Plus Jakarta Sans 700, `letter-spacing: -0.025em`. Scales cleanly from 96px (app icon) to 16px (favicon) via strokeWidth adjustment.

The 3D clay variants (Clay.com-inspired) were also designed — squircle containers with matte radial gradient, specular highlight, colored drop shadow — and saved for use as the landing page hero asset and potential app store icon.

**4. Role-differentiated headers — same layout, different emotional temperature.**
Coordinator shell: white background, teal 2px bottom border, "COORDINATOR" chip in brand-tint. Patient shell: warm amber surface `--patient-surface`, amber 2px border, "YOUR CARE" chip in patient-tint. Identical structural markup, completely different emotional register — coordinator feels like a tool, patient feels like receiving care. Solves the "which role am I in?" disorientation without any navigation action.

**5. Strategic UX direction — five structural changes.**

After reviewing Apollo 247 (5-tab bottom nav, two separate apps for patient/doctor), Practo (5-tab bottom nav, Practo Pro separate app for providers), and MediBuddy (no bottom nav flagged as a UX flaw, corporate vs employee vs doctor separate entry points), decided:

- **Landing page at `/`** — not a redirect to login. A proper orientation page.
- **Coordinator is the only self-serve signup** — no role selector. The default experience IS the coordinator experience.
- **Patients access via invite link/code** — coordinator generates a shareable link (6-char alphanumeric token, `carealig.vercel.app/join/a3x9kp`), shares via WhatsApp. Patient taps link → authenticated instantly → no password, no credential burden. Backend: `patient_invites` table, `/join/[token]` route, single-use token expires in 7 days.
- **Sidebar navigation for coordinator on tablet+** — not bottom nav. The app has 2 primary destinations (patient list, patient detail), not 5+. Bottom nav is for apps with many peer destinations. A sidebar fits a tool-shaped app.
- **Patient view stays sidebar-free** — read-only consumption, not a tool. Should feel like receiving a care update, not using software.
- **Coordinator patient detail restructured** — Documents tab first (the action that drives everything), Summary tab second (AI output, secondary), Tasks tab third. Current layout buries the upload zone below a large summary panel.

**6. All three reference platforms share one key pattern: separate shells per role, not in-app role switching.**
Apollo has two separate apps (`Apollo 247` and `Apollo Doctor 247`). Practo has `Practo` and `Practo Pro`. MediBuddy has employee app, HR portal, and doctor portal. CareAlign's existing architecture (`/dashboard` for coordinator, `/patient/[id]` for patient) was already right. The missing piece was making that separation visually legible — which the header differentiation now does.

**What resisted?**

The ESLint rule definition landed outside the `rules` object on the first write — a structural error. One-line fix, caught immediately by `pnpm lint:arch`. Token renaming required updating 5 files (globals.css, logo.tsx, coordinator layout, patient layout, @theme inline block) — no functional change, but necessary for the naming to be composable long-term.

**What did I understand?**

`--primary: var(--brand-base)` is the highest-leverage design system change possible. One CSS line cascades through every Shadcn component without touching a single component file. The Shadcn token system is designed for exactly this. The lesson: design system work that touches the token layer compounds across the entire UI; work that touches individual components is additive at best.

The research finding that surprised: none of Apollo 247, Practo, or MediBuddy do in-app role switching. The industry pattern is not a role-switching button — it is separate shells. CareAlign had the right architecture. The problem was that the shells looked identical. The fix was visual differentiation, not an architectural change.

Patient invite link over typed code: a typed code requires the patient to switch apps, read alphanumerics, type under stress on a hospital ward. A WhatsApp link requires one tap. The code is a fallback for the case where the link doesn't render (older SMS clients, printed handouts). Design the primary path for one tap; design the fallback for one line of text.

---

## Landing Page IA — Decisions 2026-06-15

**What did I decide?**

**1. Landing page is an orientation page, not a marketing page.**
Primary audience is warm referrals — coordinators who were told about CareAlign and arrive to sign in or register. The job: confirm they're in the right place in 5 seconds, show the product in 30 seconds, build enough trust to hand over medical documents. Not a discovery page for strangers. Consequence: shorter than a typical SaaS page — 6 sections, no pricing, no feature grid.

**2. Scope framing corrected — not just document translation.**
CareAlign manages and organises patient health records across multiple episodes and multiple hospitals into one connected picture. Episode Timeline, Living Summary, and Pending Tasks are first-class features, not footnotes. The IA was underselling this in V1. Section 4 now surfaces all five capabilities as equal pillars.

**3. Three taglines, three placements — no overlap.**
- **Hero H1:** "From a folder of papers to a connected picture of your care." — Visual, relatable, uses the exact language from the origin story. Every Indian family recognises "the folder."
- **How it works heading:** "Organize it. Translate it. Understand it." — Three parallel verbs, each maps directly to a step (Upload → AI reads → Patient understands). The heading does the work so step descriptions stay one sentence each.
- **Closing CTA:** "Because the patient deserves to understand what is happening to them." — Moral weight without preachiness. The word "deserves" lands hardest at the emotional peak of the page, not the top.

**4. Section 5 "What CareAlign is not" — one line updated.**
"Not a storage app" → "Not just a storage app. It is the comprehension layer with organized storage to connect the dots and make sense of health records." Acknowledges storage as part of the product while clearly positioning comprehension as the differentiator.

**5. 3D clay icons carry the narrative, copy stays minimal.**
Every section has a primary clay-style 3D icon as the visual explainer. No stock photos, no human faces. The icons use the same material treatment as the logo (matte radial gradient, specular highlight, colored shadow). Coordinator context: teal. Patient context: amber. Mixed: split teal-amber.

**6. Inner pages refactored before product screenshots are taken.**
Landing page is last in the build queue, not first. Screenshots of unpolished inner pages on a marketing page actively damage trust. Build order: auth pages → coordinator sidebar + view restructure → patient view → invite flow → landing page.

**7. Interaction animation principles for this page.**
Hero: stagger-in on load (opacity 0→1, y 12→0, ease-out-quart, 80ms between elements). Section reveals: scroll-triggered fade+slide. "The Moment" section: text lines stagger one by one. Problem cards: 100ms stagger. Document morphing animation in "How it works" step 2: dense card → translation card, ease-in-out-cubic, 500ms, plays once on viewport entry. Background gradient: very slow hue shift (±8 degrees, 12s, linear, infinite), disabled under prefers-reduced-motion.

**What resisted?**
The initial IA underweighted the multi-episode, multi-hospital scope — treating CareAlign as a document translator rather than a health record comprehension layer. The messaging reference document corrected this in one read. The discipline is: use the product's own copy as the IA source of truth, not generic SaaS section templates.

**What did I understand?**
Tagline placement matters as much as tagline quality. B ("From a folder of papers...") earns its place at the top because it names the before-state every coordinator already lives in — recognition is the fastest trust signal. A ("Organize it. Translate it. Understand it.") earns its place in "How it works" because verbs are more instructive than noun-based headings. E ("Because the patient deserves...") earns the closing position because it shifts from product to principle — the last thing a reader carries away should be the reason the product exists, not what it does.

---

## Phase 10 — Patient Invite Flow — 2026-06-16

**What did I decide?**

Eight decisions, made in sequence across several design pivots and a security audit. This phase had more reversals than any prior one — each reversal was right for a reason worth recording.

**1. Frictionless access via invite URL → abandoned for PIN-based access.**
The first implementation sent the patient straight to their care page after clicking the invite link — anonymous Supabase session created server-side on page load, no form, no code. The reasoning: the invite URL is 256-bit token, effectively unguessable, therefore it IS the authentication. This holds technically but fails the healthcare use case: if the URL leaks (WhatsApp message forwarded, screenshot, shared device), the leaked URL grants full access to medical documents. The URL is "something you have" with no second factor. For any communication channel other than face-to-face, that's a single point of failure. Pivot: URL + 6-digit PIN sent via separate channel (URL on WhatsApp, PIN over voice call).

**2. Indian demographic constraints drove the PIN channel decision — not SMS OTP, not email, not a typed code.**
The alternatives were evaluated seriously:
- **Email OTP**: ruled out. Email penetration below Tier 2 is near zero in practice — patients in rural India have Gmail accounts created by family members for phone registration, often don't know the password, never open them. Email as a delivery channel is a non-starter for remote village use cases.
- **SMS OTP**: better penetration (feature phones receive SMS), but: delivery unreliability in rural areas, 5–20 minute delays, spam filter silencing, multi-SIM confusion, literacy requirements. Introduces a third-party infrastructure dependency with known failure modes precisely where failure matters most.
- **App-generated typed code**: eliminates third-party infrastructure but adds the same form friction as email OTP.
- **Voice call + PIN**: the coordinator already has the patient's phone number (they're managing their hospitalisation). A voice call is universal — ₹500 feature phones can receive calls. The coordinator reads six digits. The patient types six digits. This is two-factor without any infrastructure dependency beyond the WhatsApp link and a phone call. The mental model is familiar: every Indian who has used mobile banking has entered an OTP.

The name matters: called it "access code" not "OTP" in the UI. "OTP" means "the SMS from my bank" to Indian users — they would wait for an SMS that never comes.

**3. PIN is coordinator-controlled and coordinator-revocable, not a user-set credential.**
The 6-digit PIN is generated cryptographically server-side (`crypto.getRandomValues` → 1,000,000 combinations), bcrypt-hashed before storage, and shown to the coordinator exactly once in the dialog. The coordinator calls the patient and reads it aloud. The patient never sets it, never sees it in their email, never manages it. If the PIN is lost, the coordinator generates a new link and new code — there is no PIN reset path, because the reset IS generating a new link. This is appropriate: the coordinator owns the access grant. The patient is the recipient, not the account manager.

**4. Rate limiting: 5 wrong attempts locks the token permanently.**
With 1,000,000 combinations and 5 attempts, brute-force is computationally implausible. The lock is permanent by design — coordinator generates a new link when locked. No "unlock after 30 minutes" mechanic, no email-based reset. Permanent lock prevents any timed brute-force strategy. The coordinator can always generate a fresh link; there is no situation where a legitimate user is permanently locked out unless the coordinator chooses not to help them.

**5. Toggle: coordinator can disable PIN for direct access — with a mandatory risk acknowledgment.**
One design pattern: always require PIN. Second: always skip it. Third (chosen): default ON with a toggle and a checkbox acknowledgment when OFF. The OFF state requires the coordinator to explicitly confirm "I understand anyone with this link can view care documents." The acknowledgment prevents accidental misconfiguration — the toggle alone (without confirmation) is too easy to click without reading. The UX uses the same `border-brand-border bg-brand-tint` highlight for the active option on both cards — initially missed this on the "direct access" card (the selected state was visually identical to unselected), caught and fixed.

**6. "Generate new invite" expires unused prior invites — but does NOT revoke existing patient_access.**
Initial implementation collapsed two distinct actions into one: generating a new invite also deleted all `patient_access` rows with `role='patient'`. The intent was: "the old link is now invalid, and so is any access from it." But this is wrong for the most common regeneration reason — the patient lost the PIN code before using it. In that case there is no prior patient_access to revoke; the patient is trying to get in for the first time. Revoking all patient_access on every new invite generation also cuts off a patient who is actively viewing their care documents. The correct model: generating a new invite ONLY expires unredeemed tokens — access already granted is intentionally preserved. Explicit revocation is a separate action with a separate button, confirmation dialog, and a clear description of consequences.

**7. Two actions, not one: `createInvite` and `revokePatientAccess` are separate.**
`createInvite`: expires all pending (unredeemed) invite tokens for this patient, creates a new token and PIN. Never touches `patient_access`.  
`revokePatientAccess`: deletes all `patient_access` rows with `role='patient'` for this patient AND expires all pending invites. Used when the coordinator believes the wrong person has access — a deliberate, consequence-communicating action with a confirmation dialog.

This separation maps to two real coordinator intents: "give this person a new link" (common) and "cut off whoever has access right now" (rare, serious). Conflating them into one action was a mistake caught during testing.

**8. Patient page 404 replaced with in-shell friendly message.**
When a patient visits their care page after access is revoked, `notFound()` was throwing a raw 404 — bypassing the patient layout entirely, showing a default Next.js error with no context. Replaced with an in-component message that renders inside the patient shell (amber header visible): "Your access to this care record has ended. Contact your coordinator to receive a new link and regain access." The same pattern applied to the patient-not-found case. The patient layout stays visible so the user knows they are in the right application.

---

**What resisted me?**

**The RLS vulnerability from enabling anonymous auth — found before any anonymous user touched the system.**

Enabling Supabase anonymous sign-ins surfaced a critical flaw in the existing `patient_access` INSERT policy:

```sql
WITH CHECK (
  EXISTS (...coordinator check...) OR user_id = auth.uid()
)
```

The `OR user_id = auth.uid()` clause was written for "self-registration" — the initial seed data pattern where the first patient_access row for a new user is inserted by that user. But every actual `patient_access` insert in the codebase uses `createServiceClient()`, which bypasses RLS entirely. The clause was never needed and never used by real code. With anonymous auth disabled, the risk was theoretical — a logged-in coordinator could abuse it. With anonymous auth enabled, any anonymous user could call:

```ts
supabase.from('patient_access').insert({
  user_id: theirAnonymousUserId,
  patient_id: anyPatientIdTheyKnow,
  role: 'patient'
})
```

And it would succeed. Patient UUIDs appear in `/patient/[patientId]` URLs — they are not secret. An anonymous user who had ever seen a patient URL could self-grant access to that patient's medical records.

Migration `20260616000001_fix_patient_access_rls.sql` removed the `OR user_id = auth.uid()` clause before any anonymous user was created. The fix is one DROP + one CREATE — no data change, no functional change for any real use path.

**The `patient_invites` RLS UPDATE trap — silent failure, wrong fix, right diagnosis.**

The first attempt at expiring old invites in `createInvite` used the regular Supabase client:
```ts
await supabase.from('patient_invites').update({ expires_at: now })...
```

`patient_invites` has RLS enabled with INSERT and SELECT policies but no UPDATE policy. RLS default-deny means the UPDATE from an authenticated user silently affects 0 rows — Supabase returns a success response with no error. The old invites remained valid. The coordinator generated a new link; the old link still worked. Fix: switch the expiry UPDATE to `createServiceClient()` — service role bypasses RLS. Lesson: every UPDATE/DELETE on an RLS-enabled table must explicitly check which client is performing it. A silent 0-row-affected result is the only signal of a policy mismatch, and it looks identical to a successful update on an already-filtered result set.

**Patient documents showing 0 despite existing — missing RLS SELECT policy.**

The patient view page calls `getEpisodeDocuments()` which queries the `documents` table via the regular RLS-enforced client. The initial schema set `documents` as coordinator-only:

```sql
-- documents — coordinator only (patient does not see raw documents)
```

With RLS, the patient's query returned 0 rows — triggering the empty state "No documents have been processed yet. Your coordinator is working on it." regardless of how many translated documents existed. Migration `20260616000003_patient_document_read_access.sql` added a patient SELECT policy on `documents`. The original intent (patients don't see raw documents) was preserved at the application layer — the patient view renders `document_translations`, not raw documents — but the query infrastructure needed the SELECT permission to execute at all.

**The `Promise.all` non-issue that wasn't.**

One implementation of `createInvite` used `Promise.all` to run two DB operations in parallel — expiring invites and deleting patient_access. This was flagged as "no purpose" by the product owner. The `Promise.all` WAS correct (two independent operations, parallel is the right pattern), but the OPERATIONS themselves were wrong (deleting patient_access belonged in `revokePatientAccess`, not `createInvite`). The code smell was the wrong operation, not the concurrency pattern. Recording this distinction: `Promise.all` of two genuinely independent operations is correct and should not be simplified to sequential awaits for readability alone.

**Coordinator visiting old join URL — expected "expired", got redirected to dashboard.**

When a coordinator visits any join URL (expired, used, or valid), the join page RSC detects `profile.role === 'coordinator'` and immediately calls `redirect('/dashboard/[patientId]')`. This fires before any expiry check. The coordinator expected to see "this link has expired" — instead they were silently redirected to their own coordinator view of the patient. Technically correct behaviour (a coordinator should see their dashboard, not an invite redemption page), but confusing when testing expiry. No code change made — the redirect is right. This is a documentation and expectation issue, not a bug.

**join URL reload — 404 instead of redirect.**

After redeeming an invite and being redirected to `/patient/[patientId]`, a patient who navigated back to the join URL got "This invite link has already been used" instead of being redirected to their care page. Root cause: the `used_at` check was a universal guard that ran before the `existingAccess` check. Reordering fix: check `existingAccess` before `used_at` for logged-in users. A patient with valid `patient_access` is always redirected, regardless of whether the invite is used or expired. The `used_at` check then correctly serves only the case where a logged-in user has no access and tries to use a token someone else already redeemed.

---

**What did I understand today that I didn't yesterday?**

**The Indian demographic stack determines the auth stack.** Email → SMS → voice call is not a stack you choose based on preference or developer convenience. It is a stack determined by who your users are and where they are. Email fails in rural India not because email is bad but because it assumes digital infrastructure that simply isn't present. The "right" auth mechanism for a healthcare app serving Tier 2–4 cities and villages is one that degrades to a phone call. Everything else is designed for a different user.

**Anonymous auth and RLS interact at the role level, not the user level.** Anonymous users get the Supabase `authenticated` role — the same role every signed-in user gets. RLS policies that apply to `authenticated` without checking `patient_access` or specific user metadata are exposed to every anonymous user. The warning Supabase surfaces when enabling anonymous sign-ins ("anonymous users will use the authenticated role when signing in") is not a caveat — it is a demand to audit every policy that uses `TO authenticated` without an additional guard. The `OR user_id = auth.uid()` clause was in an INSERT policy with a long comment explaining its purpose, written before anonymous auth existed as a concern. It was invisible as a vulnerability until the auth mode changed.

**The generate-vs-revoke distinction is a product decision, not a technical one.** Every version of "invalidate the old access when generating a new link" was technically implementable. The question was what a coordinator actually intends when they click "generate new invite." In most cases: the patient hasn't used the link yet and needs a fresh one (no patient_access to revoke). In rare cases: someone got in who shouldn't have (explicit revocation needed). These are different intents, different frequencies, and different consequences. Collapsing them into one action forces every coordinator to assume the aggressive behaviour (revoke) even when they only want the gentle one (refresh). Separating them forces the coordinator to make a deliberate choice when taking the destructive action.

**Supabase service client usage is a load-bearing architectural decision, not a convenience.** Every time `createServiceClient()` appears in the codebase, it is bypassing RLS. That bypass exists for exactly one reason: the operation is impossible through RLS because the access conditions that would permit it don't exist yet (chicken-and-egg) or shouldn't exist (service-level operations that users should never perform directly). The corollary: every UPDATE or DELETE that a coordinator should legitimately perform needs an RLS policy. Using service client because "I forgot to write the policy" is hiding a hole in the access model. Using service client because "the policy would be wrong" (like deleting all patient_access rows on invite generation — a policy that would let any coordinator delete any patient's access) is using it correctly.

---

## Content Pipeline

When ready to post, paste raw notes from any phase above into a Claude conversation with:

```
Platform: [LinkedIn / X / Blog]
Raw notes: [paste the three answers]
Help me shape this into a post in my voice.
Do not generate content — ask me questions first.
```

---

## Post Ideas (generated from the spec and build journey)

These are not scheduled. They are written when the moment is real.

**Origin posts (write first — before anything technical)**
- The hospital corridor. The folder. Running between departments alone.
- The blood test report I couldn't understand. The Googling. The waiting.

**Thinking posts (write while building)**
- Why I spent the first session writing docs instead of code
- The question that changed my data model: "does the patient always need to know what to do tomorrow?"
- Why I chose Claude over GPT-4 for medical document translation
- What cognitive surrender actually looks like when you're building with AI
- Why silence is a valid output: `actions: []` is correct, not a bug

**Decision posts (write at each milestone)**
- The moment I realised Eka Care was infrastructure, not a competitor
- Why "silence is a valid state" is a product principle, not a feature
- The three concepts that look the same but aren't: auth vs profile vs access grant
- Why the database enforces access, not the application

**Struggle posts (write when it happens — not after)**
- The migration that failed because SQL function bodies compile at definition time
- The afternoon I wanted to skip the spec and just start building
- Why getting a Blob token out of Vercel taught me something about security design
- The Tailwind v4 colour space change that broke my CSS test in exactly the right way

**Launch post (write on final day)**
- Here's what I built. Here's why. Here's the live URL.

---

## Voice Reference

**What your content is:**
Writing about how to think about problems — not how to solve them — because the thinking is what transfers across contexts, not the solution.

**What it is not:**
- Tutorials
- How-to guides
- Feature announcements
- Personal branding performance

**The tone:**
Honest. Direct. Specific. The same voice you use when you catch your own mistake and say "wait, that doesn't feel right."
