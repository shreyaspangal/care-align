# Organize eval harness

The regression suite for the product's core (`docs/PRACTICES.md` §6, `docs/BUILD_PLAN.md` Phase 2 "Test focus").

Every case is one document plus a hand-authored expected extraction. Each run scores two independent things:

1. **Field accuracy** — did the model copy what the document actually says? (Hard Rule 2, verbatim-or-null.) Split into **fabrications** (a wrong, non-null value) and **omissions** (an honest null) — see "Grounding" below.
2. **Boundary compliance** — did any advisory language leak into the prose it generated? (Hard Rule 1, explain-never-advise.) **Any** hit is a hard fail regardless of accuracy.

### Grounding

The boundary-check patterns and the fabrication/omission split aren't just internal judgment — they're grounded in specific Indian regulatory sources (CDSCO's medical-device-software guidance, the DPDP Act), researched and recorded once, in one place: **`docs/DECISIONS.md` D-014**. That entry also lists what was researched and explicitly ruled out for lacking real backing. The live checklist derived from it — rule, source, exact enforcement location, status, plus copy-ready trust messaging for UI/landing-page use — is **`docs/INDIA_COMPLIANCE.md`**. Extend `lib/eval/score.ts` only from that same discipline — a new pattern needs a real source, not a plausible guess — and update both docs in the same commit.

## Running it

```bash
pnpm eval              # live: calls the real configured model, writes eval/results/<ts>-<prompt_version>.json
pnpm eval -- --record  # live, and overwrites each case's cached-response.json (refreshes the CI fixtures)
pnpm eval:smoke        # cached: replays committed recordings through the same scorer. No API key, no network. CI runs this.
```

`pnpm eval` loads `.env.local` if present; `pnpm eval:smoke` needs no environment at all.

### What each mode proves

| | `pnpm eval` | `pnpm eval:smoke` |
|---|---|---|
| Calls the model | yes | no |
| Measures model/prompt quality | yes | **no** |
| Proves the harness itself works | yes | yes |
| Exit code reflects | case pass/fail | harness health + committed boundary violations |

Cached mode's exit code deliberately ignores plain accuracy mismatches in the replayed cases — a cached response is a *recording*, and gating CI on its accuracy would make CI red or green for reasons no commit can change. It fails when the harness is broken (the scorer self-check fails, a cached response no longer satisfies `OrganizeSchema`, a case can't be replayed) **or when a committed fixture has a boundary violation** — that's a defect in the repo itself (a leak baked into a recording), not a fact about "the model today," so it isn't given the same pass. `--record` enforces this at the source too: it refuses to overwrite a fixture with a response that has any boundary violation, scoring first and only writing if clean. Whether the model is any good otherwise is a question only `pnpm eval` can answer.

The scorer self-check that runs before the replay is what gives cached mode teeth: it scores two synthetic outputs whose verdict is known by construction — one deliberately advisory and wrong, one exactly right — and asserts the scorer catches the first and clears the second. A scorer that stopped detecting anything, or started failing everything, breaks it.

## The gate (PRACTICES §6)

No prompt or model change merges if the eval score regresses. Results are written per `prompt_version` into `eval/results/` so the history is a diff rather than a memory. Comparing a run to the previous one is a human read of two JSON files today — deliberately not automated while the eval set is placeholder data.

**Before treating any live run as a real score, check `AI_MODEL_TIER`.** `DECISIONS.md` D-004's revisit trigger is a hard gate: the dev tier currently points at a free OpenRouter model that does not enforce the response schema. The runner prints a warning when the tier isn't `production`; that warning means "these numbers are exploratory", not "nearly there".

## How it runs without a bundler

`eval/run.mjs` is plain JavaScript executed by Node directly — the repo has no `tsx`, `ts-node`, or build step for scripts, and adding one for this would owe a `docs/DECISIONS.md` entry (Hard Rule 14) for a dependency that only exists to start a script. Instead:

- Node (≥22.18, and the version CI pins) strips TypeScript types natively, so `run.mjs` can import `lib/**/*.ts` as-is.
- `eval/loader.mjs` is a ~30-line resolve hook registered with `node --import`. It teaches Node two things it can't know on its own: the `@/*` tsconfig path alias, and that `server-only` should resolve to its own no-op `empty.js` (this harness *is* a server process; the throwing default export is a bundler marker). Nothing else is intercepted.

`lib/eval/` holds everything that needs type-checking — the case schema and the scorer — so it is covered by `pnpm lint:arch` like the rest of `lib/`.

## Adding a case

1. `mkdir eval/cases/<case-id>/` and put the document in it.
2. Write `expected.json` (see `lib/eval/case.ts` for the schema). Omit any field you can't state an exact expected value for — omitted fields are not scored; an explicit `null` **is** a scored assertion that the document doesn't print it.
3. `pnpm eval -- --record` to score it and record a cached response for CI.

Every organize failure found while dogfooding becomes a case here, permanently (PRACTICES §6).

For synthetic-fixture specifics see `eval/cases/README.md`.
