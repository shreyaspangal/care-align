# design-sync notes — CareAlign

Repo-specific gotchas for syncing this design system to claude.ai/design.
This is a **Next.js 16 application** repo, not a standalone published DS package —
so several things differ from the converter's defaults.

## How the bundle is assembled (read first)

- **No built `dist/`.** Components are source `.tsx` under `components/{primitives,composites,features}`.
  The bundle entry is a hand-written barrel: `.design-sync/ds-entry.tsx` (re-exports the 23 storied
  components), passed via `--entry`. Run the converter with:
  `--entry ./.design-sync/ds-entry.tsx --node-modules ./node_modules`.
- **Export roster comes from a types barrel.** The converter enumerates the public component surface
  from the package's types entry. With no dist `.d.ts`, we point `package.json` `"types"` at
  `.design-sync/ds-entry.d.ts` (a `.d.ts` barrel mirroring `ds-entry.tsx`). Without it the converter
  reports `[TITLE_UNMAPPED] 23` and drops every component. **Keep `ds-entry.tsx`, `ds-entry.d.ts`,
  and the `package.json` "types" field in sync with the storied component list.**

## [GENERAL] CSS — do NOT set cfg.cssEntry

- `app/globals.css` is **Tailwind v4 source** (`@import "tailwindcss"`, `@theme inline`), not compiled
  CSS. Setting `cfg.cssEntry` to it ships the raw source, which does nothing in a browser → unstyled
  previews. Leave `cssEntry` unset so the storybook shape scrapes the **compiled** CSS from
  `.design-sync/sb-reference` (`[CSS_FROM_STORYBOOK]`, ~71 KB). The reference storybook build is what
  compiles Tailwind, so it must be rebuilt whenever component classes change.

## [GENERAL] next/navigation + next/link → browser stubs

- Components import `next/navigation` (usePathname/useRouter) and `next/link`. The real Next client
  runtime reads `process.env.__NEXT_*` and bare `process`, which is undefined in the browser →
  `ReferenceError: process is not defined` thrown during IIFE evaluation → **nothing attaches to
  `window.CareAlign`** and every preview is empty.
- Fix: `cfg.tsconfig` points at `.design-sync/tsconfig.bundle.json`, which keeps the `@/*` alias and
  aliases `next/navigation` → `.design-sync/stubs/next-navigation.tsx` and `next/link` →
  `.design-sync/stubs/next-link.tsx` (plain anchor). esbuild's tsconfig-paths plugin resolves these.
- **Router stub returns a fixed `usePathname() === '/'`.** Route-driven nav active state is therefore
  not reflected in previews. In practice the active-row styling is subtle and previews render
  identically to storybook (graded match), but see Re-sync risks.

## Overrides applied (cfg.overrides)

- `DocumentsSection.skip: ["features-documentssection--empty"]` — the "renders nothing" story returns
  null (empty array) and tripped `[RENDER] root empty`. Skipped; the "With documents" story is the card.
- `PendingTaskRow.cardMode: "column"` — the AllCategories story is wider than a grid cell (`[GRID_OVERFLOW] wide`).
- `TranslationOutputPanel.cardMode: "single", primaryStory: "CoordinatorView"` — sheet/portal overlay
  (`[GRID_OVERFLOW] escape`).

## Known render warns (triaged — judged via the compare oracle, not validate)

These print `[RENDER_THIN] variants render identically` but are legitimate:
- `PatientTabNav`, `PatientViewTabNav` — tab navs differ only by active route; the router stub returns a
  fixed pathname, so all story variants render the same. Verify the rendering itself is faithful.
- `CreatePatientForm` — Default vs AdmittedSelected differ only by which radio is checked (near-identical).
- `PatientInviteButton`, `RevokeAccessButton` — trigger buttons; closed state is identical across stories.

## Accepted `close` / partial verification (graded, not bugs)

- **TranslationOutputPanel** — the Sheet portals into `document.body`, so the storybook canvas root
  is empty and the compare oracle reports `sb-error` for all 6 stories (it can't capture the reference).
  Handled with `cardMode: "single"` + `primaryStory: CoordinatorView`; the CoordinatorView story was
  verified by **direct inspection of the single-mode card render** (full sheet, title, hospital, "What
  this means for you" box, coordinator/patient actions). The other 5 states are sibling-trusted (same
  Sheet, different data). A re-sync will re-report sb-error — this is expected, not new.
- **TasksClient** — "Card view (grouped by category)" and "With post-discharge (hidden until toggled)"
  are revealed by `userEvent.click` in the story `play` function. A static preview shows the correct
  pre-click default; the post-click view is not statically reproducible → graded `close`.
- **DocumentClassificationEditor** — "Edit Mode" opens via a `play`-function pencil click; internal
  `useState`, no prop to force it. Static preview shows view mode → `close`.
- **PatientTabNav / PatientViewTabNav** — active tab is `usePathname`-driven (router stubbed to '/').
  In this run storybook itself rendered "Documents" active across these stories, so storybook and preview
  agree visually; non-default-active stories graded `close` (route-driven, not reproducible).

## Re-sync risks (what can silently go stale)

- **Storied component list drift.** If components are added/removed, update all three barrels:
  `ds-entry.tsx`, `ds-entry.d.ts`, and confirm `package.json` "types". A missed entry → `[TITLE_UNMAPPED]`.
- **Next stubs.** If components start using more of the `next/navigation` surface (e.g. `useSearchParams`
  values, `useParams`), extend `.design-sync/stubs/next-navigation.tsx`. The stubs return inert values.
- **Router-driven nav active state** is never shown in previews (fixed pathname). If the active-row
  styling becomes more prominent, those nav stories may drop to `close`/`mismatch` and need an owned
  preview or a richer stub.
- **`.d.ts` prop quality.** The types-barrel project doesn't load tsconfig `paths`, so component props
  that reference `@/lib/types/domain` aliases may resolve to `any` in the emitted `<Name>.d.ts`. Use
  `cfg.dtsPropsFor.<Name>` if a contract matters and came out weak.
- **Toolchain:** Tailwind v4.3.0, Storybook @storybook/nextjs-vite 10.4.3, playwright 1.61 / chromium-1228.
