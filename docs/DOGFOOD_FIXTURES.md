# Dogfood fixtures — manifest

> Purpose: give the real capture → organize → timeline → visit-brief pipeline
> a varied, realistic-looking set of documents to run by hand while the real
> 10–15 founder-family documents (`docs/BUILD_PLAN.md` Phase 2, `docs/PRACTICES.md`
> §6) still don't exist. **This is not the scored eval harness** (`eval/cases/`,
> D-016) — no `expected.json`, nothing wired into `pnpm eval`. It's for manually
> uploading through the app's real capture UI and eyeballing what `organize()`
> does with each `doc_type`.

Files live in `fixtures/dogfood/`, which is **gitignored** — the sourced PDFs
are a third party's copyrighted templates (redistributing them permanently in
a public repo isn't the intent of downloading them for local testing), and
none of this needs to be CI state. This file is the tracked record of what's
there, tagged, so a future session doesn't have to re-derive it.

## Tagging convention

- **SOURCED** — downloaded from a public site, unmodified. Real-looking
  values, but the site itself states these are template/example documents,
  not real patient records.
- **GENERATED** — written by Claude this session as plain text, then rendered
  to PDF with `fixtures/dogfood/make-generated.mjs` (same hand-rolled
  single-page PDF writer as `eval/make-fixtures.mjs`). Each one's first line
  is `GENERATED FOR DOGFOODING - SYNTHETIC, NOT A REAL ...`, printed directly
  on the page, so it's unmistakable in a screenshot or the app UI.

Both tags mean **no real PHI** — safe to run through the real pipeline,
safe to have sat on a laptop, nothing to redact.

## Inventory by `doc_type`

| `doc_type` | File | Tag | Source |
|---|---|---|---|
| `lab_report` | `sourced/lab_report/cbc-normal.pdf` | SOURCED | [Drlogy CBC normal](https://images.drlogy.com/assets/uploads/lab/pdf/CBC-test-report-format-example-sample-template-Drlogy-lab-report.pdf) |
| `lab_report` | `sourced/lab_report/cbc-abnormal.pdf` | SOURCED | [Drlogy CBC abnormal](https://images.drlogy.com/assets/uploads/lab/pdf/Abnormal-CBC-test-report-format-example-sample-template-Drlogy-lab-report.pdf) |
| `lab_report` | `sourced/lab_report/cbc-with-esr.pdf` | SOURCED | [Drlogy CBC+ESR](https://images.drlogy.com/assets/uploads/lab/pdf/CBC-with-ESR-test-report-format-example-sample-template-Drlogy-lab-report.pdf) |
| `lab_report` | `sourced/lab_report/lipid-normal.pdf` | SOURCED | [Drlogy Lipid normal](https://images.drlogy.com/assets/uploads/lab/pdf/Normal-Lipid-profile-test-report-format-example-sample-template-Drlogy-lab-report.pdf) |
| `lab_report` | `sourced/lab_report/lipid-abnormal.pdf` | SOURCED | [Drlogy Lipid abnormal](https://images.drlogy.com/assets/uploads/lab/pdf/Abnormal-Lipid-profile-test-report-format-example-sample-template-Drlogy-lab-report.pdf) |
| `lab_report` | `sourced/lab_report/thyroid-normal.pdf` | SOURCED | [Drlogy Thyroid normal](https://images.drlogy.com/assets/uploads/lab/pdf/Normal-Thyroid-profile-test-report-format-example-sample-template-Drlogy-lab-report.pdf) |
| `lab_report` | `sourced/lab_report/thyroid-abnormal.pdf` | SOURCED | [Drlogy Thyroid abnormal](https://images.drlogy.com/assets/uploads/lab/pdf/Abnormal-Thyroid-profile-test-report-format-example-sample-template-Drlogy-lab-report.pdf) |
| `lab_report` | `sourced/lab_report/hba1c-normal.pdf` | SOURCED | [Drlogy HbA1c normal](https://images.drlogy.com/assets/uploads/lab/pdf/HbA1c-test-report-format-example-sample-template-Drlogy-lab-report.pdf) |
| `lab_report` | `sourced/lab_report/hba1c-abnormal.pdf` | SOURCED | [Drlogy HbA1c abnormal](https://images.drlogy.com/assets/uploads/lab/pdf/Abnormal-HbA1c-test-report-format-example-sample-template-Drlogy-lab-report.pdf) |
| `lab_report` | `sourced/lab_report/lft-normal.pdf` | SOURCED | [Drlogy LFT normal](https://images.drlogy.com/assets/uploads/lab/pdf/Normal-Liver-profile-LFT-test-report-format-example-sample-template-Drlogy-lab-report.pdf) |
| `lab_report` | `sourced/lab_report/kft-normal.pdf` | SOURCED | [Drlogy KFT](https://images.drlogy.com/assets/uploads/lab/pdf/KFT-test-report-format-example-sample-template-Drlogy-lab-report.pdf) |
| `discharge_summary` | `sourced/discharge_summary/nabh-emitra-format-blank.pdf` | SOURCED | [NABH/e-Mitra official format](https://nabh-portal-live.s3.ap-south-1.amazonaws.com/wp-content/uploads/2025/07/18074912/D.-E-Mitra_FORMAT-04_Hospital-Discharge-Summary-Format.pdf) — **blank fields**, not filled-in. Useful for exercising the null-handling path (Rule 2), not the happy path. |
| `prescription` | `generated/prescription/source.pdf` | GENERATED | Claude, this session. Indian dosing notation (`1-0-1`, dd/mm/yyyy), diabetes/hypertension follow-up. |
| `imaging_report` | `generated/imaging_report/source.pdf` | GENERATED | Claude, this session. Abdominal ultrasound, one incidental finding (gallstone) to give `organize()` something concrete to extract. |
| `vaccination_record` | `generated/vaccination_record/source.pdf` | GENERATED | Claude, this session. Infant immunization card, multiple dated doses + a "next due" line. |
| `bill` | `generated/bill/source.pdf` | GENERATED | Claude, this session. Itemized hospital bill with GST, admission/discharge dates. |
| `doctor_note` | `generated/doctor_note/source.pdf` | GENERATED | Claude, this session. Pediatric OPD note, no investigations advised (tests `tests_as_written` should come back empty/null, not invented). |

## Still weak — look here in parallel (HuggingFace / Kaggle / other trustworthy sources)

These `doc_type`s only have a **GENERATED** (Claude-authored) example each, which
proves the pipeline runs but is a weak substitute for a document with real-world
noise (phone-camera glare, handwriting, stamps, non-Latin script mixed in,
inconsistent layout) — exactly the gap `eval/cases/README.md` already calls out
for the synthetic eval placeholders. Worth searching for real alternatives to
replace or supplement:

- **`prescription`** — a real handwritten or printed Indian prescription image (not OCR-transcribed text). Checked: HuggingFace `chinmays18/medical-prescription-dataset` only has OCR ground-truth text, no confirmed image files — needs re-checking, or look at the MIRAGE dataset (arXiv 2410.09729, Indian prescriptions, likely needs a data-access request) or Kaggle prescription-OCR datasets.
- **`imaging_report`** — a real radiology report (X-ray/ultrasound/CT) with an actual clinical impression, not a generic template.
- **`vaccination_record`** — a real Indian immunization card or CoWIN-style certificate image/PDF (not a fillable blank template).
- **`bill`** — a real itemized hospital or pharmacy bill (GST invoice format is right, but real ones have messier line items).
- **`discharge_summary`** — a real **filled** discharge summary (the one fixture here is an official blank format, good for the null-path but not the happy path).

If a good real source turns up for any of these, drop it into
`fixtures/dogfood/sourced/<doc_type>/` and add a row to the inventory table
above — don't silently replace the GENERATED one without noting it here.
