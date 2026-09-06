# CareAlign v2 — Anti-Patterns

> Things that bit us in v1 (or will bite in v2 if forgotten), each with the failure mode and the correct pattern. Entries are only added after a real incident or a verified near-miss — this is scar tissue, not speculation. Full v1 history: `docs/archive/carealign-v1/ANTI_PATTERNS.md`.

---

## 1. Supabase two-layer access control — the silent 0-row write

**Failure mode:** `.update()` / `.delete()` returns `{ error: null }` but writes 0 rows. RLS and table GRANTs are two independent layers; if the GRANT exists but no RLS policy covers the operation for the caller, Postgres filters every row out silently. **This failed silently 3 times in v1.**

**Rule:** every migration that creates a table must include both layers:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON table_name TO authenticated;
GRANT ALL ON table_name TO service_role;
-- plus RLS policies for every verb the app actually uses
```

After writing any `.update()` or `.delete()`, grep migrations for `FOR UPDATE` / `FOR DELETE` on that table. v2 automates this as RLS proof tests in CI (PRACTICES §4) — a scripted second-family user must get 0 rows from every table.

**Trigger-writes corollary:** any trigger writing to `public.*` (e.g. profile bootstrap on signup) needs explicit grants to `supabase_auth_admin` and `OWNER TO postgres` on the function.

## 2. Next.js 16 breaking changes vs. training data

This is Next **16** — agent training data is full of Next 14/15 idioms that compile-fail or (worse) silently misbehave:

- **`middleware.ts` is `proxy.ts`.** A file named `middleware.ts` is silently ignored — auth gate simply doesn't run.
- **`cookies()`, `headers()`, and route `params` are async.** `const { id } = params` without `await` type-errors; in loosely-typed spots it yields a Promise and breaks at runtime.
- **`revalidateTag` requires a `cacheLife` argument**; `updateTag`/`refresh` exist for Server Actions.
- **`useActionState` signature is `(_prev, formData)`.** Forgetting `_prev` shifts the args so `formData` receives the previous state object — **no type error, silent wrong behaviour**.

When unsure, read `node_modules/next/dist/docs/` — not memory.

## 3. AI SDK v6 deprecated APIs

`generateObject` / `streamObject` are `@deprecated` in `ai@6+`. The canonical pattern is `generateText + Output.object({ schema })`; the typed result is `result.experimental_output`; the error class is `NoOutputGeneratedError` (not `NoObjectGeneratedError`); file parts use `mediaType` (not `mimeType`). `pnpm lint:arch` fails CI on the deprecated APIs. Verify against `node_modules` types, never memory.

## 4. Client components importing server actions

A `'use client'` file importing from `actions/*` pulls `next/cache` / `next/headers` into the client bundle graph — crashes Storybook and the vitest browser runner. **Pattern:** the parent RSC injects the action as a prop; stories pass `fn()` from `storybook/test`. `import type` is fine (erased at compile time). Enforced by `carealig/no-client-action-import`.

## 5. Documentation describing machinery that doesn't exist

v1's TESTING.md described a test suite that was never built — worse than no doc, because it manufactured false confidence. **v2 rule (PRACTICES §4):** a practices/testing table may only list what CI actually runs; adding the row and adding the CI job is one commit.

## 6. Undocumented decisions

The v1 "profile-based naming" migration happened with no ADR — months later nobody could tell what was intended vs. drifted, and it triggered the rebuild. **v2 rule (PRACTICES §2):** nothing enters `package.json` or the architecture without a DECISIONS.md entry. An undocumented decision is indistinguishable from a bug.

## 7. Inline redefinition of DB-aligned union types

Redefining a DB enum's union type inline in a component works until the DB enum changes — then the copy drifts silently and narrows/widens without a type error at the boundary. All DB-aligned unions live in one types module and are imported. Enforced by lint rule.

## 8. Roles baked into names and tokens

v1 named components, routes, and design tokens after roles (`coordinator`, `patient`) — when the model changed, the vocabulary was wrong everywhere at once. v2 has **no roles**: one family account, profiles within it. The words "coordinator" and "patient" (as a role) are banned from identifiers; design tokens are role-free (`accent`, `ai`, `success`).

## 9. Parameterized server actions — `.bind(null, id)` looks wrong but is the pattern

**Failure mode:** an action like `changeProfilePin(profileId, _prev, formData)` needs a route-level ID, but `useActionState` always calls actions as `(prev, formData)`. The call site `action={changeProfilePin.bind(null, profile.id)}` reads as obscure JS trickery, so readers reach for "cleaner" alternatives that are actually downgrades (this confused a real review in Phase 1):

- **Hidden `<input name="profileId">`** — moves the ID from render-time plumbing into user-editable form data: plaintext in the HTML, must be added to every Zod schema, and the action's contract becomes "whatever the client sent". Safe only because RLS rescues it; still a downgrade.
- **Inline `'use server'` closure per page** — scatters action-invocation logic across page files and swaps a documented idiom for a homegrown one.
- **Action factory in `actions/`** — impossible: `'use server'` modules may only export async server functions, not sync factories.

**Correct pattern:** extra args go first in the action signature; the RSC page binds them: `updateProfile.bind(null, profile.id)`. This is the official Next.js/React idiom: fully type-checked (`strictBindCallApply` via `strict: true`), the bound value is serialized *encoded* into the action payload (not rendered in HTML), and it survives progressive enhancement. The `null` is just the unused `this` argument.

**Not a security boundary:** the server never trusts a bound ID — anyone can invoke an action with arbitrary args. RLS + explicit checks (e.g. `verifyPinAuthority`) authorize every write regardless of what was bound.

## 10. Asymmetric ownership checks across sibling endpoints

**Failure mode:** the Phase 2 capture flow has two server-side steps touching the same client-supplied `profileId` — the upload-sign route and the `createDocument` action. The sign route correctly verified the profile belongs to the caller's family (relying on RLS to return `null` otherwise). `createDocument` resolved `family_id` from the caller's own family and inserted it alongside the client-supplied `profileId` **without the same check** — nothing in the database enforces that `documents.profile_id` belongs to `documents.family_id` (it's a bare FK to `profiles(id)`, and the RLS policy on `documents` only checks `documents.family_id = current_family_id()`). Two endpoints that look like they do "the same kind of check" silently didn't, and only one of them actually mattered for data safety, because it was the one writing the row.

**Rule:** whenever a client-supplied ID references another family-scoped table, every endpoint that *writes using that ID* must independently re-verify it belongs to the caller's family — never assume a sibling endpoint (a "sign"/"prepare" step, a GET, a different action) already proved it, and never assume a foreign key alone enforces cross-table family-scoping (it only enforces the row exists, not who owns it). Reads relying on RLS to return `null` are fine for reads; every write path needs its own ownership check right before the insert/update, stated as explicitly as the read-side one. Grep for every place a request body's ID flows into an `.insert()`/`.update()` and confirm each has a preceding ownership query — pattern: `.select('id').eq('id', suppliedId).maybeSingle()`, `!row → reject`.

**Why this one is more severe than a normal bug class:** it produces a cross-family data-integrity hole (a document recorded under the right family but attached to a different family's profile), which is exactly the class of leak Hard Rule 5 exists to prevent — RLS proof tests (PRACTICES §4) check `family_id` scoping on the row being written, but do not currently catch a *correctly-scoped* row that references a *wrongly-scoped* related row. Revisit trigger: extend the RLS proof suite to also assert that every FK column pointing at a family-scoped table can never reference a row from a different family, for at least one adversarial case per foreign key.

---

*Add entries only after a real incident. Each entry: failure mode → correct pattern → enforcement (if any).*
