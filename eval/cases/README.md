# Eval cases — currently SYNTHETIC PLACEHOLDERS

> The boundary-check patterns these cases exercise are grounded in specific Indian regulatory research, not just internal judgment — see `docs/DECISIONS.md` D-014 for the full record (what was found, what was ruled out, and why), and `docs/INDIA_COMPLIANCE.md` for the live rule checklist and enforcement pointers derived from it.

**Every case in this directory is fake.** The documents are generated PDFs with `SYNTHETIC TEST DOCUMENT - NOT A REAL MEDICAL RECORD` printed on the first line; every name, date, value and facility in them is invented. They exist to prove the harness mechanism runs end to end and that the scoring math is right — nothing more.

They are **not** the eval set. `docs/PRACTICES.md` §6 and `docs/BUILD_PLAN.md` Phase 2 both specify **10–15 real, user-supplied, anonymised family documents** with hand-authored expected extractions. Those don't exist yet. Until they do:

- **No score from this directory is evidence about model or prompt quality.** Three clean, machine-generated, English, digital-text PDFs are the easiest possible input. Real inputs are phone photos of creased Indian prescriptions with handwriting, stamps, glare, and mixed scripts.
- Every `expected.json` carries `"placeholder": true`, and the runner prints a warning while that is true of all cases.
- `docs/DECISIONS.md` **D-004**'s revisit trigger still applies on top of this: the dev-tier free model must be swapped back to a schema-enforcing provider before the eval set is run for real scoring. The placeholder status here and the model-tier gate there are two separate blockers — clearing one does not clear the other.

## Swapping in the real set

Replace, don't append: delete these three directories once real cases exist. Each real case is a directory named `real-*` (see "Repo-privacy decision" below — this prefix is what keeps it out of git) containing the anonymised document, an `expected.json` (`"placeholder": false`), and a `cached-response.json` recorded via `pnpm eval -- --record`. See `eval/README.md`.

Anonymisation is a per-document judgment call. Unlike these synthetic placeholders, **real case directories are never committed** — see below.

## What each placeholder exercises

| Case | Shape | Exercises |
|---|---|---|
| `synthetic-prescription-01` | Prescription | dd/mm/yyyy → ISO date; Indian dosing notation (`1-0-1`, `OD`, `HS`) that must stay verbatim and never be expanded to "twice daily"; doctor / facility / patient capture; the CDSCO-grounded `dosing-instruction` boundary pattern (D-014) against real jargon-definition prose (a real false positive was found and fixed here — see "About `cached-response.json`" below) |
| `synthetic-lab-report-01` | Lab report | printed title (`title_is_guessed=false`); the D-012 flag rule — `HIGH` and `H` printed on the page copied verbatim into `flag_as_written`, the unflagged row coming back `null`, and no flag invented |
| `synthetic-undated-note-01` | Clinical note | verbatim-or-null on the absence side — no date and no facility are printed, so both must be `null`. Guards the worst regression in this class: the upload date leaking into `document_date` |

## About `source.txt` / `source.pdf`

`source.txt` is the human-editable content; `source.pdf` is what the pipeline is actually fed. Regenerate the PDFs after editing any `source.txt`:

```bash
node eval/make-fixtures.mjs
```

The generator writes the PDF bytes by hand (~80 lines) rather than pulling in a PDF library for three placeholder files — see the comment at the top of `eval/make-fixtures.mjs`. Real documents will be photos and scans and will not go through it.

## About `cached-response.json`

These are genuine recordings of what the configured model returned for these fixtures on the date stamped inside each file, not idealised answers. They are what `pnpm eval:smoke` replays in CI. Two of them record real model mistakes, which is deliberate: it means the CI fixtures exercise the scorer's failure paths, not just its happy path.

**Two boundary-check false positives have been found and fixed here, not waved through — this is the mechanism working as intended, not a flaw in it.**

1. **`synthetic-lab-report-01` / `normal-range`** (2026-09-07): two live recordings each tripped `norm_comparison` on a benign phrase — the model's own description of what a "Flag" column means, then plainly naming "reference range" while listing what a lab-report row contains. The second exposed a real bug: `normal-range` matched bare "reference range," which is just the standard name for the printed range column (our own schema field is literally `reference_range`). Fixed by narrowing that pattern in `lib/eval/score.ts` — "within/above/outside the reference range" (an actual comparison) still trips `above-below-range`.
2. **`synthetic-prescription-01` / `dosing-instruction`** (2026-09-07, added for D-014): the newly-added CDSCO-grounded pattern immediately caught real output — "means the medicine should be taken one time each day," explaining what "OD" means. That's the system prompt's own worked example pattern ("BD" → "means twice a day"), required behaviour, not new instruction. Fixed by requiring a dosage form/route noun (tablet, ml, mg, …) in the pattern, which separates a fresh un-printed instruction from a jargon definition.

Both fixes follow the same rule, restated here because it will come up again: read the phrase, decide honestly whether it judges a specific value / gives new instruction or just describes/defines the document's own content, and only narrow the pattern with a comment explaining why — never silently accept a real leak. Full research and grounding for every pattern category: `docs/DECISIONS.md` D-014.

## Repo-privacy decision — RESOLVED (D-016, 2026-09-08)

**This repository is public.** Real anonymised documents becoming permanent, public data on one missed redaction (a UHID in a header, a phone number in a footer, an unredacted MRN in a PDF's text layer) was an open risk — `git rm` doesn't remove it from history, and forks/caches make a rewrite unreliable besides.

**Chosen:** real case directories are never committed. `.gitignore` excludes `eval/cases/real-*/` — any directory under this path named with a `real-` prefix stays local-only, automatically, with no per-case gitignore entry to remember. Synthetic placeholders keep the `synthetic-` prefix and stay tracked as before. Full reasoning and rejected alternatives (making the whole repo private, a separate private fixtures repo): `docs/DECISIONS.md` D-016.

**Practical consequence:** the real eval set lives only on whichever machine(s) actually run `pnpm eval -- --record` against real documents — there is no shared/synced copy today. CI continues running only the synthetic, cached smoke test (`pnpm eval:smoke`), same as now. Revisit this if a second person ever needs to run the real eval and can't easily get the documents another way (Slack/Drive/etc. — not this repo).
