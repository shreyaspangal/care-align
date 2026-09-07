# CareAlign v2 — Agentic Development Workflow (Claude Code)

> How we use Claude Code to run development, testing, and observability so the founder's attention stays on strategy, UX flows, dogfooding, and approvals. This is an operating manual, not aspiration — each item names when it fires and who/what executes it.

---

## 1. Division of labour — founder vs. agents

**Founder owns (never delegated):** wedge/strategy calls, UX flow decisions, OPEN entries in DECISIONS.md, commit approvals (standing rule), phase-gate sign-off, dogfooding with real family documents, and being the user the product-engineer handbook says to talk to.

**Main agent (Fable, this thread) owns:** architecture and design deltas, schema/migrations, the AI pipeline and prompts, security-sensitive code (RLS, auth, file serving), code review synthesis, decision-record drafting, and all judgment calls that need full project context.

**Subagents own (spawned per §3):** parallelizable self-contained implementation, mechanical generation, broad codebase searches, and specialized review passes.

## 2. Model policy for subagents

| Task class | Model | Rationale |
|---|---|---|
| Architecture, prompts, security, reviews-of-record | **Fable (main thread)** | Judgment + full context; not delegated |
| Self-contained feature implementation from a written spec (a component + story, a DAL module) | **Sonnet** | Strong coding, cheaper; the spec quality is the main thread's job |
| Mechanical generation: story scaffolds, test boilerplate, fixture data, doc formatting | **Haiku** | Fast/cheap; output is verified by lint:arch + review anyway |
| Read-only codebase sweeps ("where do we…", conformance scans) | **Explore agent** | Purpose-built, read-only, returns conclusions not dumps |

## 3. When to parallelize (and when not to)

Subagents start **cold** — they re-derive context. So the rule is: parallelize only tasks that are (a) self-contained, (b) fully specified in writing, and (c) independent along the commit-layer boundaries (schema / DAL / actions / components / pages). Examples per phase:

- **Phase 1:** main thread writes migration + RLS; in parallel, Sonnet builds profile-picker UI from the design spec, Haiku generates story files.
- **Phase 2:** main thread owns organize prompt + `after()` pipeline; Sonnet builds the capture client component against the written contract; Haiku builds eval fixtures from founder-supplied documents.
- **Anti-pattern (don't):** parallel agents editing the same layer, or spawning an agent for a task cheaper to do inline than to specify.

Long-running verification (CI runs, eval suites) runs as background tasks; the main thread continues and reconciles on completion.

## 4. Skills map — what fires when

Installed today: `grill-with-docs`, `frontend-design`, `tdd-workflow`, `code-reviewer`, `skill-creator`, `find-skills`, `next-best-practices`, `api-security-audit`, `api-rate-limiting`, `thermo-nuclear-review`. To install: **Impeccable** (`npx impeccable install` or Claude Code marketplace).

| Moment | Skill | Purpose |
|---|---|---|
| Phase start | `grill-with-docs` | Interrogate the phase's design-doc section before code |
| Phase 1 (auth/routes) | `next-best-practices` | Next 16 conformance |
| Phase 2 (token route, file route) | `api-security-audit` + `api-rate-limiting` | The two security-critical routes |
| Any lib/unit work | `tdd-workflow` | Tests-first for pure logic |
| UI phases (3–5) | `frontend-design` + **Impeccable** (`/typeset`, `/colorize`, anti-slop detector) | Design vocabulary + AI-slop prevention; generate `DESIGN.md` from our tokens so agents inherit the system instead of inventing |
| Every phase gate | `code-reviewer` | Standard review pass |
| End of Phase 2 (the heart) | `thermo-nuclear-review` and/or founder-triggered `/code-review ultra` | Deepest scrutiny where failure is least acceptable |
| As gaps appear | `skill-creator` | Mint project-specific skills (see §5) |

## 5. Project-specific skills to mint (via skill-creator, when the phase needs them)

1. **`phase-gate`** — runs the PRACTICES §8 checklist literally: CI status, diagram-diff check, DECISIONS delta, tracking-plan verification, CONTENT_LOG prompt. (Phase 0)
2. **`eval-run`** — executes the organize eval set, reports per-field accuracy + boundary violations vs. last `prompt_version`. (Phase 2)
3. **`rls-audit`** — spawns an Explore pass over migrations + a scripted second-user test against every table. (Phase 1)

## 6. Permissions + hooks + CI (the always-on layer — enforced whether the agent "chooses to" or not)

**Permissions** (`.claude/settings.local.json`): an **allow-list** only — a short list of specific `WebFetch` domains, `WebSearch`, and one pinned `Bash` command. There is **no deny-list** configured (secrets directories, prod configs, destructive commands) — that class of protection currently relies on the system-prompt-level "confirm before risky actions" rule, not a hard-enforced settings block. Revisit if this project ever needs a stronger guarantee than agent judgment.

**Hooks** — shell commands that fire unconditionally, not something a model can skip:
- **Git pre-commit** (`.githooks/pre-commit`, wired via `git config core.hooksPath .githooks`): tsc + lint:arch + check-stories, blocks the commit itself. **Verify this is actually wired after every fresh clone** — `core.hooksPath` defaults back to `.git/hooks` (empty) if the `prepare` script never ran or was reset; a missing hookspath fails silently (no error, just no gate) and was found un-wired once already (2026-09-07, fixed by rerunning `git config core.hooksPath .githooks`).
- **Claude Code PostToolUse hook** (`.claude/settings.json`): `pnpm lint:arch` auto-fires after every `Edit`/`Write` on a `.ts`/`.tsx` file, surfacing failures back into the conversation as a system message — this runs regardless of what the agent intends to do next.
- **GitHub Actions** (Phase 0): the PRACTICES §5 chain on every push; Impeccable's deterministic detector joins the chain in Phase 5 (it's rule-based, no LLM — CI-safe).
- Red CI = phase gate blocked; no exceptions.

## 7. Standing collaboration rules (founder-set, apply to every session)

These aren't in any settings file — they're working agreements the founder has stated directly, tracked in Claude Code's memory across sessions, and repeated here so a fresh session (or a fresh subagent) doesn't have to rediscover them the hard way.

- **Commit confirmation.** Never run `git commit` without showing the diff/results and getting an explicit "yes" for *that specific batch* of work — an earlier approval never carries forward to the next round of changes, no matter how similar in shape or how green the gates are.
- **No unrequested writes.** Never create or edit a file (code, docs, scripts) without saying what's about to change and getting a go-ahead first.
- **Browser-test before done.** For any UI change, drive it live with Playwright against the running dev server before calling it done — `tsc`/`lint:arch`/unit tests prove code correctness, not visual or flow correctness.
- **Docs before trial-and-error.** Before iterating with speculative changes against a live/production system, exhaust official documentation first, then ask before any remaining guesswork — never loop blindly against something real.
- **Stay in the loop on issues.** On any blocker, stop and report/ask promptly rather than trying several silent workarounds — the founder should never feel like they're "going blind" while an agent hits a wall alone.
- **No throwaway scripts.** Prefer a single direct one-off command (e.g. `node --input-type=module -e "..."`) over writing-then-deleting a scratch file, and don't re-verify or re-poll something the elapsed time/context already makes obvious.
- **Single source of truth for docs.** A status/state fact lives in exactly one canonical file; every other doc points to it, never restates it (`AGENTS.md` = build status, `DECISIONS.md` = decision status via each entry's own header).
- **Honest re-evaluation under pushback.** "Doesn't this create confusion / is this standard" is a request to actually re-audit for concrete evidence (duplication, prior incidents), not to restate the original reasoning more confidently.
- **Model/effort routing for subagents.** State the model + effort level before spawning any subagent; route high-reasoning work (deep debugging, audits, real tradeoffs) to an Opus/high-effort agent rather than reasoning it out inline in a Sonnet-medium main thread.
- **Deviation from wedge/scope** gets flagged in the moment, not absorbed silently (founder-requested, 2026-07-14).
- **Questions over assumptions** — an OPEN decision entry or a direct question, never a silent default.
- **Reference intake is gated:** new articles/tools get one digest pass into an existing doc (DECISIONS / DESIGN_REVIEW_LENS / this file) with an adopt-or-park verdict — never open-ended absorption.

## 8. Observability of the workflow itself

- `docs/CONTENT_LOG.md` — the retro journal (kept from v1; it was v1's most valuable doc).
- Task tracking in-session for multi-step phases; background tasks for CI/eval waits.
- Memory (Claude Code auto-memory) holds durable working agreements; repo docs hold everything a new session must know — CLAUDE.md points to PRACTICES, DECISIONS, SYSTEM_DESIGN, this file.
