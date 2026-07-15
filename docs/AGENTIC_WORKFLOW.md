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

## 6. Hooks + CI (the always-on layer)

- **Pre-commit** (`.githooks`): tsc + lint:arch + check-stories — already active.
- **PostToolUse hook**: `pnpm lint:arch` auto-fires when component/action files are written — already configured in `.claude/settings.json`.
- **GitHub Actions** (Phase 0): the PRACTICES §5 chain on every push; Impeccable's deterministic detector joins the chain in Phase 5 (it's rule-based, no LLM — CI-safe).
- Red CI = phase gate blocked; no exceptions.

## 7. Observability of the workflow itself

- `docs/CONTENT_LOG.md` — the retro journal (kept from v1; it was v1's most valuable doc).
- Task tracking in-session for multi-step phases; background tasks for CI/eval waits.
- Memory (Claude Code auto-memory) holds durable working agreements; repo docs hold everything a new session must know — CLAUDE.md points to PRACTICES, DECISIONS, SYSTEM_DESIGN, this file.

## 8. Standing communication rules

- Deviation from wedge/scope gets flagged in the moment, not absorbed silently (founder-requested, 2026-07-14).
- Questions over assumptions — an OPEN decision entry or a direct question, never a silent default.
- Reference intake is gated: new articles/tools get one digest pass into an existing doc (DECISIONS / DESIGN_REVIEW_LENS / this file) with an adopt-or-park verdict — never open-ended absorption.
