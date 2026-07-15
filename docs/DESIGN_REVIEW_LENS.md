# CareAlign v2 — Design Review Lens

> The recurring checklist for re-checking our design decisions, digested from **Impeccable** (impeccable.style) and **Product Design Psychology** (Wouter de Bres, productdesignpsychology.com). Runs at the gates of UI-bearing phases (3, 4, 5) and on any UX-flow change.
>
> **Digestion status (honest):** Impeccable — fully digested (tool + principles). PDP — structure and theses digested from all four parts; per-chapter deep-reads are scheduled to the phases where they bite (§4), so the lens sharpens as we build rather than pretending 41 chapters are internalized today.

---

## 1. Impeccable — adoption plan

What it is: a design-vocabulary skill pack + a **deterministic 46-rule "AI slop" detector** (no LLM — CI-safe) + `DESIGN.md` convention so agents inherit an existing system instead of inventing one.

- **Phase 0:** install (`npx impeccable install` / marketplace).
- **Phase 3 (first real UI):** generate `DESIGN.md` from our design tokens so every agent-built component inherits the token system (this operationalizes v1's `no-raw-color-values` rule at the vocabulary level).
- **Phase 5:** add the deterministic detector to the CI chain.
- **Ongoing:** use its explicit commands (`/typeset`, `/colorize`, `/animate`) instead of vague design asks — its core philosophy (remove reflexive AI defaults; respect restraint/hierarchy/contrast) is exactly the failure mode we must avoid building UI with agents.

## 2. The four-part PDP lens → CareAlign checklist

### The Designer's (Founder's) Mind — bias checks
- [ ] **"Nobody thinks like you" / "Your knowledge is the problem":** the founder can no longer see the product as a novice — every flow must be tested on one family member who didn't build it before a phase ships. (This is our cheapest usability lab and the antidote to founder-blindness.)
- [ ] **"Love at first sketch":** the first design we liked (the visit brief layout, the timeline card) gets one deliberate alternative before it's final.
- [ ] **"Deadlines make you dumb":** phase estimates are budgets, not deadlines — cutting scope beats cutting thinking (aligns with PostHog's "why not now?" over artificial dates).

### Minding the Design — interface mechanics
- [ ] **"Design the last moment first":** our last moment is the **visit brief in front of a doctor** — it gets designed and mocked BEFORE the timeline is polished (Phase 3 ordering rule, adopted into BUILD_PLAN).
- [ ] **"Stop hiding what's clickable":** capture — the core action — must be the most obvious affordance on every profile screen.
- [ ] **"Your UI is exhausting" / "More options make users quit":** capture flow ≤ 3 decisions (profile, optional hint, submit); every added option needs a DECISIONS entry.
- [ ] **"Fake progress is real motivation":** the "Organizing…" card shows staged progress, not a dead spinner.
- [ ] **"Stop breaking the pattern":** one card grammar, one date format (`en-IN`), one action placement across timeline/search/brief.

### The User's Mind — the family's psychology
- [ ] **"Old habits beat better products":** WhatsApp + the file drawer are the incumbents. Every flow must be nearer to the habit than the habit is to itself (capture from camera roll = the WhatsApp-photo habit, redirected).
- [ ] **"Users want now, not later":** value on the FIRST capture (the onboarding profile-proposal moment) — not after ten documents.
- [ ] **"Users don't think in tasks":** navigation by person and moment ("Amma", "the visit"), never by our nouns (documents, explanations).
- [ ] **"Your users are lying to you" / "React, then rationalize":** dogfood observations (PostHog session replays) outrank family members' verbal feedback.
- [ ] **"Your design doesn't translate":** medical + English UI for non-English-first users — plain words, icons with labels, no jargon in chrome (full regional support stays V2+).

### The Organization's Mind — even a team of one
- [ ] **"The metric is not the user":** the north-star (retrieval moments/family/month) is a *check* on the wedge, not a target to game with notification spam.
- [ ] **"You solved the wrong problem":** at every dogfood retro, re-ask: did this week's usage match the wedge statement in 05-direction? Divergence gets flagged, not rationalized.
- [ ] **"Better ship it than admit it":** killing or reworking a shipped feature is a recorded decision, not a failure — DECISIONS.md gets the entry.
- [ ] **"Research as alibi":** references (this doc included) inform decisions; they never substitute for shipping and watching real usage.

## 3. How this integrates

- Phase gates 3–5 run the relevant section of §2 as literally as the PRACTICES §8 checklist.
- Any checklist miss is either fixed before gate or recorded as a conscious exception in CONTENT_LOG.

## 4. Scheduled deep-reads (chapters → phases)

| Phase | Chapters to read in full before its gate |
|---|---|
| 3 (timeline/search UI) | "Pass the Vibe Check First", "Your UI Is Exhausting", "Stop Breaking the Pattern", "Layout Speaks Before You Do" |
| 4 (visit brief) | "Design the Last Moment First", "Nobody Remembers Your UI" |
| 5 (onboarding/landing) | "Users Want Now, Not Later", "More Options Make Users Quit", "Users Will Ignore You", "Old Habits Beat Better Products" |
| Dogfood retros | "Your Users Are Lying to You", "You Solved the Wrong Problem", "The Metric Is Not the User" |
