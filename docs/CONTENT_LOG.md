# CareAlign — Content Log

> Daily capture of the building journey. Raw notes only — no editing, no formatting. The editing happens later. The only rule: capture it the same day it happened.

---

## The Three Questions

At the end of every build session, answer these three:

1. **What did I decide today?** — Not what you built. What decision you made and what you were choosing between.
2. **What resisted me today?** — The moment where something was harder than expected. The friction. The doubt. The temptation to pivot.
3. **What did I understand today that I didn't yesterday?** — The insight that shifted something.

---

## Phase 1 close — PostHog wiring, a proxy bug, and live-data verification — 2026-07-17

**What did I decide?**

The PostHog wizard's output was treated like any other contributor's PR: audited against our rules, gated, and improved — not rubber-stamped. Three decisions on top of it. **Server-side captures moved into `after()`** — the wizard's flush-before-redirect pattern made every instrumented action pay an EU round-trip before the user saw anything; Next 16's `after()` delivers the same guarantee post-response. **`PostHogIdentify` relocated to `components/analytics/`** rather than given a fake story — it renders null; a story would have been gate-appeasement, and the honest fix was recognising it isn't UI. **Wizard reports filed under `docs/research/`** with an explicit staged-files check proving `extracts/` (premium content) stayed out of the commit.

**What resisted me?**

The verification pass found a bug the wizard could not have known about: `proxy.ts` runs before `next.config` rewrites, so every logged-out `/ingest` POST was 307'd to `/login` and silently dropped — register and login pageviews, the top of the funnel, gone. Nothing errored; the browser network log was the only witness. One matcher exclusion fixed it, and the fix also spares a Supabase `getUser()` round-trip per event batch.

Verifying server-side events took three failed routes (PostHog EU login wall in the test browser, the MCP connector bound to a US account that 403'd, an interactive wizard TUI that can't run without a raw-mode stdin) before the boring one worked: a personal API key and a direct HogQL query.

**What did I understand?**

"The integration works" and "the events arrive" are different claims, and only the second one counts. The live query returned the test session event-by-event — `user_logged_in` at 12:59:48, `profile_selected` at 13:00:45, `profile_unlocked` at 13:02:15 — each landing milliseconds before its matching pageview, proving both delivery and that `after()` kept capture off the critical path. Checklist item 3 ("events verified in live view") exists precisely because an instrumented event that silently 307s into an auth redirect looks identical to a working one from inside the code.

---

## Phase 1 review — PIN authority model + segments defend themselves — 2026-07-16

**What did I decide?**

Founder review surfaced two things. First, the layout+page double `getProfile` call is not redundancy — it's the App Router pattern working as designed: `cache()` dedupes the two calls to one query, layouts cannot pass props to pages, and under partial rendering a page must be self-sufficient anyway. The fix went the other direction: the timeline page now runs its own `notFound()` guard instead of optional-chaining around a profile the layout already validated. Every segment defends itself.

Second, and bigger: **replacing a profile PIN no longer works without proof.** The prior behaviour ("account holder can set or replace any profile's PIN without knowing the old one") made the PIN decorative — any family member could bypass it from the edit page in two clicks, and the replace action even rotated the unlock cookie in their favour. New model (Netflix profile locks): changing or removing an existing PIN requires the current PIN (profile-holder proof) or re-entering the account password (account-holder proof — identity can't distinguish family members, there is only one login). First-time set stays open: no PIN exists to prove against, and a bad-faith set is recoverable via the password path. Without that recovery path, a forgotten PIN would lock the family out of those records forever — the old no-verification behaviour was, accidentally, the recovery path, and it had to be replaced, not just deleted.

**What resisted me?**

"Only the account-holder should be able to…" sounds like a role — and roles are banned (Hard Rule 4). The resolution: these scopes are proofs of possession (a PIN, a password), not identities. Nobody *is* the account-holder in the data model; someone *proves* account-holder scope at the moment of action by re-entering the password. That reframing kept the no-roles rule intact while delivering exactly the two scopes the founder asked for.

Also: our own lint rule (`carealig/no-raw-html-primitives`) rejected the raw `<button>` I wrote for the verification toggle — the enforcement stack catching its own author, again.

**What did I understand?**

A privacy lock whose change path requires no proof isn't a weak lock — it isn't a lock. The threat-model framing "privacy, not security" had quietly excused the gap: even a privacy feature needs its mutation path gated, or it only *signals* privacy without providing any. And the verification burden splits cleanly along what each party can possess: the PIN proves you're the person the profile is about; the password proves you're whoever the family trusts with the account.

---

## Phase 1 — Foundation: schema, auth, profiles, storage decision — 2026-07-16

**What did I decide?**

Three recorded decisions. **D-003 (file storage) closed with data instead of vibes:** the ≤2h spike measured Supabase Storage at 404ms per upload from India versus 3,195ms for Vercel Blob — 8x, because the bucket is colocated with the DB in Singapore — and image transforms turned out to work on our plan. v1 never ran this comparison; it inherited Blob because a tutorial used it. **D-010:** enum-like columns are text + CHECK constraints, not Postgres enums — doc_type WILL change as the eval set teaches us real Indian document categories, and enums can't drop values. **D-011:** the timeline's event-date fallback bakes Asia/Kolkata into the index expression, because Postgres rejected the naive `::date` cast as non-IMMUTABLE and UTC would date evening captures (prime after-clinic hours) as yesterday.

Also: reuse the wiped v1 Supabase project rather than create a fresh one (founder call — same creds, zero setup), and the register action creates the families row via service client, inheriting v1's chicken-and-egg lesson.

**What resisted me?**

The paused Supabase project — `db reset` failed twice with a misleading "set SUPABASE_DB_PASSWORD" error before a DNS check revealed the free-tier project had simply paused from inactivity; one Management API restore call fixed it. The lesson: an error message names a symptom, not a cause.

The e2e run produced one false alarm: after setting a PIN, my Playwright check reported no unlock cookie, implying the convenience-unlock was broken. A direct reproduction showed it works — the first reading was a race in my test script, and the "bug" evaporated under a cleaner experiment. Debugging the test before debugging the product saved a pointless code change.

Vitest's jsdom environment silently breaks fetch to external hosts — the RLS suite needed `@vitest-environment node`. And `families` has no `family_id` column, which my generic isolation check assumed — schema uniformity is a convention, not a law.

**What did I understand?**

The RLS proof suite is the two-layer lesson finally converted from documentation into machinery: eleven assertions including the exact silent-failure shape (`error: null`, 0 rows written) that bit v1 three times. Watching family B's update return success-with-zero-rows *as a passing test* is the difference between "we documented the trap" and "the trap now has an alarm on it." Also: the phase's entire UI was verified in a real browser against the real database before any commit — register through PIN-unlock — which caught nothing this time, and that's the point: verification that finds nothing is cheap; skipped verification that misses something is not.

---

## Phase 0 — v2 Reset: Teardown + Foundation Docs — 2026-07-15

**What did I decide?**

To execute the greenfield rebuild inside the same repo, and what "the chassis" actually means when you have to draw the line file by file. Kept: `components/ui/` (14 themed primitives), the ESLint enforcement stack + `.githooks`, `lib/{logger,ratelimit,utils,supabase}`, Storybook/vitest configs. Deleted: 130+ files — all actions, all composite/feature components, `lib/{ai,auth,dal,db,types,validation}`, all migrations, all tests, `proxy.ts`, the ds-bundle. Two files moved from "keep" to "delete" during execution: `lib/storage` (imported the deleted validation schemas, and D-003 may drop Vercel Blob entirely — keeping a half-broken module would be the TESTING.md anti-pattern in miniature) and `.design-sync/` (its entry file re-exported deleted v1 components).

Also decided the shape of the v2 rules layer: CLAUDE.md now leads with the five product-defining rules (explain-never-advise, verbatim-or-null, capture-is-sacred, no-roles, family_id + two-layer access) before any stack mechanics. v1's CLAUDE.md led with the stack; the rules that made the product safe were items 8–9 of 14. Order is emphasis.

**What resisted me?**

My own verification. After the mass delete I grepped the kept chassis for imports of deleted modules and got zero matches — but BSD grep doesn't support `\|` alternation in basic regex, so the grep was silently matching nothing. `tsc` caught what the grep missed (`lib/storage/validate.ts` → deleted schemas). The machinery beat the spot-check, again — which is the entire thesis of PRACTICES.md, demonstrated on the first day of v2 against its own author.

Also: stale `.next/` type-generation kept validating deleted routes until the cache was cleared — a reminder that "the gate is green" requires knowing what the gate is actually looking at.

**What did I understand?**

Teardown is a design act, not janitorial work. Every file you keep is a claim ("this survives the model change") and every claim can be wrong in both directions — I nearly kept `lib/storage` because it was on the keep-list from planning, when the honest test was "does this compile and does an open decision depend on it?" Lists made during planning are hypotheses; execution is when they get falsified. The repo now builds clean at 2 routes, all gates green, with the v2 five-piece scope defined entirely in docs — code follows in Phase 1.

---

> **v1 history:** the full v1 build journal (2026-06-15 → 2026-07-13, role-model era) is archived unedited at `docs/archive/carealign-v1/CONTENT_LOG.md`. This file is v2-only from Phase 0 (2026-07-15) onward; v1 phase numbers do not correspond to v2 phases.

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
