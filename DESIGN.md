---
name: CareAlign
description: A calm, restrained family health-record app — organize, explain, retrieve.
colors:
  trust-teal: "oklch(0.44 0.11 183)"
  trust-teal-on: "oklch(0.98 0.01 183)"
  trust-teal-tint: "oklch(0.96 0.025 183)"
  trust-teal-border: "oklch(0.88 0.055 183)"
  warm-highlight: "oklch(0.55 0.09 42)"
  warm-highlight-on: "oklch(0.98 0.01 42)"
  warm-highlight-tint: "oklch(0.94 0.04 42)"
  ai-indigo: "oklch(0.52 0.10 258)"
  ai-indigo-tint: "oklch(0.94 0.04 258)"
  success-green: "oklch(0.52 0.13 155)"
  success-green-tint: "oklch(0.94 0.04 155)"
  error-red: "oklch(0.577 0.245 27.325)"
  neutral-bg: "oklch(0.99 0.006 90)"
  neutral-ink: "oklch(0.13 0.01 250)"
  neutral-card: "oklch(1 0 0)"
  neutral-muted: "oklch(0.96 0.004 90)"
  neutral-muted-ink: "oklch(0.52 0.008 250)"
  neutral-border: "oklch(0.91 0.006 90)"
typography:
  body:
    fontFamily: "var(--font-sans)"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  heading:
    fontFamily: "var(--font-sans)"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  label:
    fontFamily: "var(--font-sans)"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.2
rounded:
  sm: "0.45rem"
  md: "0.6rem"
  lg: "0.75rem"
  xl: "1.05rem"
  2xl: "1.35rem"
spacing:
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.trust-teal}"
    textColor: "{colors.trust-teal-on}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
  button-primary-hover:
    backgroundColor: "{colors.trust-teal}"
  button-destructive:
    backgroundColor: "{colors.error-red}"
    textColor: "{colors.error-red}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
  badge-organizing:
    backgroundColor: "{colors.ai-indigo-tint}"
    textColor: "{colors.ai-indigo}"
    rounded: "9999px"
    padding: "2px 8px"
  badge-organized:
    backgroundColor: "{colors.success-green-tint}"
    textColor: "{colors.success-green}"
    rounded: "9999px"
    padding: "2px 8px"
  card:
    backgroundColor: "{colors.neutral-card}"
    rounded: "{rounded.xl}"
    padding: "16px"
---

# Design System: CareAlign

## 1. Overview

**Creative North Star: "The Care Folder"**

CareAlign is what a trusted family folder feels like translated to screen: quiet, unhurried, and never alarming, because the moment it exists for — a doctor asking "what happened last time" — is already stressful enough without the software adding to it. The system rejects both extremes of health software: it is not a clinical chart bristling with red flags and severity indicators, and it is not a consumer wellness app performing positivity with gradients and mascots. It sits in between, closer to a well-organized paper folder than either.

This restraint is not just aesthetic — it is the product's safety boundary made visible. CareAlign explains what a document says; it never advises, assesses severity, or implies urgency. A lab value flagged "HIGH" on the source document is shown in the same plain text as everything else, because rendering it in red or with a warning icon would be the interface making a clinical judgment the product is contractually forbidden from making. Every visual decision here either serves legibility for a family under time pressure, or gets left out.

**Key Characteristics:**
- Restrained color: one identity hue (teal) plus narrow-purpose functional colors (warm highlight, AI-processing indigo, success green) — never decoration.
- Flat-by-default surfaces (a hairline ring, not a shadow) with elevation reserved for things that are genuinely floating (dialogs, sheets).
- One typeface family carrying every role — headings, labels, body, data — because a health record is read, not admired.
- No color is ever used to imply clinical severity. Status colors describe *pipeline* state (is this document organized yet?), never *medical* state.

## 2. Colors

The palette is Restrained: tinted neutrals carry the surface, and each non-neutral color has exactly one job.

### Primary
- **Trust Teal** (oklch(0.44 0.11 183) / `#1f6e6b`-ish): the one identity color. Used for primary buttons, links, focus rings, and the brand mark. Nothing else earns this color — if a screen has more than one teal element competing for attention, one of them is wrong.

### Secondary
- **Warm Highlight** (oklch(0.55 0.09 42)): a muted terracotta-orange used only as the profile tile accent option and the appointment/date accent — a warm counterpoint to teal's coolness, never a call-to-action color.

### Tertiary
- **AI Indigo** (oklch(0.52 0.10 258)): reserved exclusively for "the AI is working" states — the "Organizing…" badge and any future AI-in-progress indicator. Indigo means "the pipeline is thinking," and nothing else in the product is allowed to use it, so that meaning stays legible at a glance.

### Neutral
- **Paper** (oklch(0.99 0.006 90)): page background. A near-white with the faintest warm tint — not the AI-default cream, just enough warmth to avoid clinical stark white.
- **Ink** (oklch(0.13 0.01 250)): primary text. A near-black with a cool undertone, matched to teal's family rather than a true neutral gray.
- **Card White** (oklch(1 0 0)): card and popover surfaces — one step lighter than the page, the only place true white appears.
- **Muted** (oklch(0.96 0.004 90) / oklch(0.52 0.008 250) text): secondary surfaces and de-emphasized text — form backgrounds, disabled states, metadata lines (dates, doctor names).
- **Border** (oklch(0.91 0.006 90)): the hairline that replaces shadows on flat cards.

### Named Rules
**The No-Severity Rule.** Color is never used to signal how alarming a medical value is. A lab flag reads "HIGH" in plain ink text with a caption explaining it was copied verbatim, never rendered in red, bold-and-red, or with a warning triangle. Explaining is not advising, and color is advice's easiest disguise.

**The One-Job Rule.** Success Green means "this pipeline step succeeded," not "this is good news medically." AI Indigo means "the model is running," never decoration. If a color starts appearing somewhere outside its one job, that's the tell something has drifted.

## 3. Typography

**Body Font:** var(--font-sans) (system sans stack)
**Heading Font:** var(--font-sans), aliased — no distinct display face has been chosen yet; this is an open, deliberate decision, not an oversight (see `docs/DECISIONS.md`).

**Character:** One family, weight-differentiated. A health record is read under time pressure, often on someone else's phone in a waiting room — it needs to be legible and familiar, not typographically expressive.

### Hierarchy
- **Heading** (600, 1.125–1.25rem, line-height 1.25): page titles, card titles, section headers (`h1`–`h6` all route through `font-heading`).
- **Body** (400, 0.875rem, line-height 1.5): the default — document text, form labels' associated values, timeline card content.
- **Label** (500, 0.75rem, tight line-height): metadata lines (dates, doctor/facility names), badge text, form field labels.

### Named Rules
**The Fixed-Scale Rule.** No fluid/clamp() type sizing anywhere. This is product UI viewed at a consistent DPI on phones and laptops, not a marketing page — a heading that shrinks in a narrow card looks like a bug, not a design.

## 4. Elevation

CareAlign is flat by default. Cards, dialogs, and popovers use a single `ring-1 ring-foreground/10` hairline instead of a shadow — depth is implied by that thin border and by white-on-paper surface contrast, not by drop shadows. Shadows are reserved for elements that are genuinely floating above the page: bottom sheets and side sheets get `shadow-sheet` because they visually detach from the layout; nothing that sits inline in the document flow gets a shadow.

### Shadow Vocabulary
- **card** (`0 1px 3px oklch(0 0 0 / 0.06), 0 1px 2px oklch(0 0 0 / 0.04)`): available but rarely used — most cards use the ring instead. Reserve for a card that must visually separate from an equally-light background behind it.
- **elevated** (`0 4px 16px oklch(0 0 0 / 0.08), 0 1px 4px oklch(0 0 0 / 0.04)`): dropdowns, popovers, anything hovering just above content.
- **sheet** (`0 20px 60px oklch(0 0 0 / 0.12)`): full sheets and modals — the one place a heavier shadow is earned, because the element is meant to feel physically lifted off the page.

### Named Rules
**The Ring-Not-Shadow Rule.** A card sitting in normal document flow (a timeline card, a document detail card) gets a `ring-1` hairline, never a shadow. Shadows are earned only by things that detach from the page (sheets, dialogs, dropdowns).

## 5. Components

### Buttons
- **Shape:** `rounded-lg` (0.75rem), consistent across all sizes.
- **Primary:** Trust Teal fill, Trust Teal-on text, `hover:bg-primary/80`. The only button that should draw the eye on a screen.
- **Secondary / Outline / Ghost:** neutral fills (secondary surface / transparent-with-border / transparent), used for every action that isn't the screen's one primary action — "Cancel," "Retry AI," "Switch profile."
- **Destructive:** a soft destructive tint (`bg-destructive/10`, not a solid red fill) for "Delete document" — visible as a warning without being alarming, consistent with the No-Severity Rule extended to the interface's own actions.
- **Hover / Focus:** all variants get a 3px `ring-ring/50` focus ring; hover is a same-hue opacity shift, never a hue change.

### Badges
- **Style:** `rounded-4xl` (pill), `h-5`, tiny (0.75rem) medium-weight text.
- **State vocabulary:** `Organizing…` uses AI Indigo tint; `Organized`/doc-type labels use Success Green tint; `Needs review` uses the neutral outline variant. This is the pipeline-state vocabulary — see the One-Job Rule.

### Cards / Containers
- **Corner Style:** `rounded-xl` (1.05rem).
- **Background:** Card White on Paper page background.
- **Shadow Strategy:** ring hairline, not shadow (see Elevation).
- **Border:** `ring-1 ring-foreground/10`, not a `border`.
- **Internal Padding:** 16px (`--card-spacing`, 12px in the compact `size="sm"` variant).

### Inputs / Fields
- **Style:** `rounded-lg`, `border-input`, transparent background, `h-8`.
- **Focus:** border shifts to `ring` color plus a 3px focus ring — same treatment as buttons, for one consistent focus language across the app.
- **Error / Disabled:** `aria-invalid` gets a destructive border and ring; disabled gets 50% opacity plus a muted background.

### Dialogs / Sheets
- **Style:** dialogs are centered, `rounded-xl`, ring-bordered, no backdrop blur beyond a light `backdrop-blur-xs`; sheets slide in from an edge with `shadow-sheet` and a border on the attached edge.
- **Use sparingly:** per the product register's own guidance, a dialog is reserved for genuinely interrupting confirmations (delete-document) — not the default way to present a form.

## 6. Do's and Don'ts

### Do:
- **Do** keep every lab flag, test result, and clinical value in plain ink text — color communicates pipeline state, never medical severity (the No-Severity Rule).
- **Do** use the ring-hairline for any card or surface sitting in normal document flow; reserve shadows for things that detach from the page (sheets, dialogs, dropdowns).
- **Do** use Trust Teal for exactly one primary action per screen.
- **Do** show skeleton states ("Organizing…" cards) for loading, never a bare spinner mid-content.

### Don't:
- **Don't** use red, orange, or a warning icon to render a flagged lab value or an out-of-range result — that is advisory language expressed as color, and it is a hard failure exactly like advisory text (CLAUDE.md Hard Rule 1).
- **Don't** introduce a second saturated color competing with Trust Teal for attention on one screen.
- **Don't** use AI Indigo or Success Green for anything other than pipeline/processing state — they are not decorative accent colors.
- **Don't** reach for a fluid/clamp() heading scale; this is product UI viewed at fixed DPI, not a marketing page.
- **Don't** default to a modal for anything that could be inline or progressive — a dialog is earned by genuine interruption (delete confirmation), not convenience.
