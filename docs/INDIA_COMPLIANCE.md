# CareAlign v2 — India Compliance Playbook

> **This file is the single, prominent place for "what Indian regulatory rules do we follow and where."** It is a checklist and a copy source, not a research paper — it states current rules, points at exactly where each one is enforced in code, and gives ready-to-use language for UI/landing-page trust messaging. It does **not** repeat the underlying research: that lives in exactly one place, `docs/DECISIONS.md` **D-014**, and this file cites it rather than restating it. If a regulation changes, D-014 is updated first (with the research), then this file's checklist is updated in the same commit — never the other way round.
>
> Read this file when: writing any user-facing copy that touches trust/safety/privacy claims, reviewing a change to `lib/eval/score.ts`, onboarding to what "explain, never advise" actually means operationally, or checking whether a compliance item is still open.

---

## 1. What "enforced" honestly means here

Before the checklist, the important caveat that belongs in every version of this document, not just this one:

**The automated gate is real and it runs on every change. It is not, and cannot be, a proof of zero advisory leakage.** The boundary check (`lib/eval/score.ts`) is a pattern-matching heuristic — it catches every known phrasing this project has encountered or anticipated, and it hard-fails CI the instant one appears in a committed fixture. It cannot catch a genuinely novel phrasing with no matching pattern. That is a property of any rule-based text check, not a gap specific to this implementation.

What IS true, and is the honest claim to make anywhere — in code comments, in a PR description, or in user-facing copy:

- Every code change to the AI pipeline runs through an automated safety check before it ships (`pnpm eval:smoke` in CI, `docs/PRACTICES.md` §5–6).
- Any real failure found — in testing or in actual use — becomes a **permanent** new check, so the same gap can never silently recur (`lib/eval/score.ts`'s own stated rule).
- The rules aren't invented internally — the categories below are traced to specific Indian regulatory sources, verified against primary documents, not assumed from general AI-safety intuition (`docs/DECISIONS.md` D-014).

Never phrase user-facing copy as "guaranteed," "100% safe," or "certified" — none of that is true of a heuristic gate, and overclaiming certainty here would be the exact failure mode (confident overreach past what's actually known) this entire product exists to avoid in its own AI output.

---

## 2. The rule checklist

Each row: the rule, its regulatory grounding (name only — full research is in D-014), and exactly where it's enforced today.

| # | Rule | Grounded in (see D-014 for detail) | Enforced by | Status |
|---|---|---|---|---|
| 1 | AI output describes documents and defines terms; never assesses severity, compares to norms, recommends treatment, or diagnoses | CDSCO Medical Device Software Guidance (2026) — the exact classification boundary between excluded record-keeping software and regulated SaMD | `lib/eval/score.ts` `ADVISORY_PATTERNS` (severity, recommendation, norm_comparison, reassurance_or_alarm, diagnosis categories) + `findBoundaryViolations`; CI hard-fails on any hit (`pnpm eval:smoke`) | **Live** |
| 2 | Impersonal treatment-option / dosing-change language ("is typically managed with," "take two tablets") is treated the same as direct advice, even with no "you" and no severity word | CDSCO's "Inform clinical management" category names this exact phrasing as the medical-purpose trigger | `treatment-options`, `options-for-treating`, `is-treated-with`, `can-be-treated`, `dosing-instruction`, `dosing-change` patterns in `lib/eval/score.ts` | **Live** (added 2026-09-07) |
| 3 | Every extracted field is copied exactly as printed, or `null` — never inferred, normalized, or defaulted | Hard Rule 2 (product rule, not itself India-specific) | `OrganizeSchema`, `ORGANIZE_SYSTEM_PROMPT` | **Live** |
| 4 | A wrong asserted value is scored and reported as a worse, distinct failure from an honest `null` | DPDP Act 2023 s.8(3) — binding duty to ensure completeness, accuracy and consistency of data that affects a person or gets disclosed to another party | `CheckKind` (`fabrication` / `omission` / `match`) in `lib/eval/score.ts`; surfaced in the CI table and the scorer self-check | **Live** (added 2026-09-07) |
| 5 | A failed/low-confidence document is never presented as a confident, wrong answer — it's flagged for manual review and stays visible | Hard Rule 3 (capture is sacred) + ICMR 2023 Ethical Guidelines §2.2(vi) (validation must assess risk to recipients, not just accuracy) | `organizeDocument`'s `markNeedsReview` fallback on every failure path (`lib/ai/organize.ts`) | **Live in the pipeline. NOT yet a scored eval dimension** — tracked as a deferred item in D-014 |
| 6 | Real, anonymised founder documents used as eval fixtures must not become permanent, public data if a redaction is missed | This repository is public (`gh repo view` confirms); no specific authority mandates this, but DPDP's general data-protection posture makes an unreviewed public commit of real health documents an obvious exposure | Documented as an **open, undecided** blocker in `eval/cases/README.md` — must be resolved before any real document is added | **OPEN — decide before real documents replace the synthetic placeholders** |
| 7 | Verifiable parental/guardian consent before processing a child's profile data | DPDP Act 2023 s.9 + DPDP Rules 2025 Rule 10 — the Fourth Schedule healthcare exemption applies to clinical establishments, not a consumer app like this one | **Not implemented.** No consent-capture step exists in profile creation today | **OPEN — product/legal decision needed before profile UI hardens further** |
| 8 | Substantive DPDP obligations (notice/consent, security safeguards, data-principal rights) become enforceable | DPDP Act 2023, phased commencement | N/A — a date to track, not a code change | **Deadline: 2027-05-14** |

---

## 3. Copy-ready trust messaging (DRAFT — needs founder/legal sign-off before shipping anywhere)

These are honest, non-overclaiming drafts for later use on the landing page, an onboarding screen, or a trust/FAQ section (`docs/SYSTEM_DESIGN.md` roadmaps the landing page as post-core-V1 — nothing below is live copy yet, and none of it should go live without a founder read-through first). Pull from here rather than improvising new claims under deadline pressure.

**One-line tagline:**
> Explains your family's medical records. Never gives medical advice.

**Short trust paragraph:**
> CareAlign organizes and explains your family's medical documents in plain language — it never assesses severity, compares results to normal ranges, diagnoses, or recommends treatment. Every release runs through an automated safety check before it ships, and any gap we find becomes a permanent test so it can't happen again.

**FAQ-style Q&A:**
> **Is this medical advice?**
> No. CareAlign explains what a document says and defines medical terms in plain language — it does not diagnose, assess severity, or recommend treatment. It's designed to help you understand and retrieve your own records, not to replace your doctor.

**Privacy line:**
> Your documents stay within your family account. Nothing is shared outside it.

None of these claim certification, guarantee, or regulatory approval — because none of those are true. If marketing/legal ever wants a stronger claim, that requires an actual review process this document doesn't substitute for.

---

## 4. Where these rules currently show up

An honest inventory, kept current — not aspirational:

- **Code:** `lib/eval/score.ts`, `lib/ai/organize-prompt.ts`, `lib/ai/organize.ts` — live, enforced, checked in CI.
- **Internal docs:** `CLAUDE.md` Hard Rule 1, `docs/PRACTICES.md` §6, `docs/DECISIONS.md` D-014, `eval/README.md`, `eval/cases/README.md` — all point here or to D-014, none restate the research.
- **User-facing UI:** **none yet.** No landing page, onboarding trust screen, or in-app compliance messaging exists in the codebase today. Section 3 above is drafted and waiting for that surface to exist — do not treat it as already shipped.

When a UI surface is built that carries any of this messaging, add it to this list with a file/route reference, so this inventory stays honest.

---

## 5. Keeping this file alive, not stale

- A new regulatory finding or a new `ADVISORY_PATTERNS` category → update `docs/DECISIONS.md` D-014 first (the research), then the checklist in §2 of this file, in the same commit.
- A new UI surface ships any of §3's messaging → add it to §4 in that same commit.
- A dogfooding failure adds a new eval pattern → the checklist row it strengthens (usually #1 or #2) gets a one-line note, not a new row, unless it's a genuinely new regulatory category.
- This file is referenced, never duplicated, from `CLAUDE.md`, `docs/PRACTICES.md`, `docs/DECISIONS.md`, `eval/README.md`, and `eval/cases/README.md`.
