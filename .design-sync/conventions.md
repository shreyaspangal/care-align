# CareAlign — building with this design system

CareAlign is a patient-coordination UI: a coordinator uploads medical documents and an AI
classifies + translates them into plain language for patients. Two roles (coordinator, patient),
one data model, different views. Build screens by **composing the components in this library** —
they carry their own styling from the bundle. Two roles map to two accent colors: **brand/teal =
coordinator**, **patient/amber = patient-facing**.

## Setup & wrapping

- **No provider is required for styling.** All design tokens live in `:root` in the bundled CSS, so
  components render fully styled as soon as `styles.css` is loaded. There is no ThemeProvider to wrap.
- **Dark mode** is class-based: add `class="dark"` to an ancestor (e.g. `<html>` or a wrapper `<div>`).
  Every token has a dark value.
- **Interactive components take their handlers as PROPS — they do not import server logic.** Pass real
  functions: `CreatePatientForm onCreatePatient={...}`, `TasksClient onResolve={...}`,
  `DocumentCard onClick={...} onDelete={...}`, `PatientInviteButton onCreateInvite={...}`,
  `RevokeAccessButton onRevoke={...}`, `EpisodeSummaryPanel`/`DocumentUploadZone` likewise. Each handler
  is async and returns `{ ok: boolean; error?: string }` (see the component's `.d.ts`).
- **Navigation components** (`CoordinatorSidebarNav`, `PatientTabNav`, `PatientViewTabNav`,
  `EpisodeSummaryPanel`) render `<a>` links and read the current path to mark the active item — in a real
  app that needs a router; in isolation they render with no active item, which is fine.

## Styling idiom — Tailwind v4 utilities + design tokens

This is a Tailwind v4 utility-class system layered on semantic CSS-variable tokens. **For your own layout
glue, prefer (a) composing the library components and (b) the design tokens below.** The shipped
stylesheet is tree-shaken — it contains only the utility classes the components already use — so a Tailwind
class no component uses may not be present. Common layout utilities ARE present (`flex`, `grid`, `gap-2/3`,
`p-4`, `px-3`, `items-center`, `justify-between`, `rounded-md/lg/xl`, `text-sm`, `font-medium`,
`text-foreground`, `bg-card`, `bg-background`, `bg-muted`, `border-input`). For any color, the robust path
is the **token CSS variables**, which are always defined:

| Token family | CSS variables (use as `var(--name)` or `style={{ color: 'var(--brand-base)' }}`) | Role |
|---|---|---|
| brand (coordinator) | `--brand-base` `--brand-on` `--brand-tint` `--brand-border` | primary accent, teal |
| patient | `--patient-base` `--patient-on` `--patient-tint` `--patient-surface` | patient-facing accent, amber |
| ai | `--ai-base` `--ai-tint` | AI-processing states, blue |
| success | `--success-base` `--success-tint` | completed/translated, green |
| neutral (shadcn) | `--background` `--foreground` `--card` `--muted` `--muted-foreground` `--border` `--primary` | surfaces & text |

Suffix convention: `-base` solid fill · `-on` text/icon on a base fill · `-tint` light wash ·
`-border` borders · `-surface` page-level wash. A few are also pre-compiled as utilities and safe to use
directly: `bg-brand-base`, `text-brand-on`, `bg-brand-tint`, `border-brand-border`, `bg-patient-surface`,
`bg-success-base`. Radius scale: `rounded-sm/md/lg/xl` (driven by `--radius`).

## Where the truth lives

- Stylesheet closure the agent receives: `styles.css` → `@import "./_ds_bundle.css"` (compiled Tailwind +
  all `:root` tokens). Read it to see exactly which utilities and tokens exist.
- Per-component API + usage: `components/<group>/<Name>/<Name>.d.ts` (props) and `<Name>.prompt.md`.
  Groups: `primitives/` (tags, badges, icons), `composites/` (DocumentCard, EpisodeStatusCard,
  PendingTaskRow), `features/` (panels, forms, nav, upload, tasks).

## Idiomatic example

```tsx
// A coordinator episode view: summary panel + document list, library components + token glue.
<div className="flex flex-col gap-3 p-4 bg-background">
  <EpisodeSummaryPanel episodeStatus="active" summary={summary} />
  <DocumentsSection documents={docs} onDelete={handleDelete} />
  <p className="text-sm" style={{ color: 'var(--brand-base)' }}>Coordinator view</p>
</div>
```
