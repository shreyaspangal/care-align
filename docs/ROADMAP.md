# Patient Coordinator — Roadmap

> Each version earns the next one. V2 starts only when V1's exit criteria pass. V3 starts only when V2's exit criteria pass. This is a dependency chain, not a feature backlog.

---

## V1 — Translation

**Status:** 🔨 Building

**Core job:**
Take medical documents the coordinator already has and make them understandable to the patient and coordinator — in plain language, organised into a coherent episode story.

**What it includes:**
- Document upload (PDF and image)
- AI classification — what type of document is this
- AI translation — what does this document say in plain language, what does it mean for this patient, what (if anything) needs to happen
- Episode timeline — all documents in chronological order
- Living episode summary — synthesised from all documents, updated on every upload
- Pending tasks — phase-aware, open/resolved tracking
- Two views — coordinator (full detail) and patient (plain language only)
- Supabase Auth — separate accounts for coordinator and patient roles
- Vercel Blob — private document storage with file_key pattern

**What it explicitly does not include:**
- Hospital system integration
- Automatic record sync
- Medication schedule extraction
- Regional language support
- Voice interaction

**Exit criteria — V1 is done when:**
1. Upload prescription, lab report, and discharge summary from real records → patient reads output and tells coordinator what to do tomorrow without explanation
2. One non-developer hospital coordinator uses it without instructions and finds it useful within 5 minutes
3. Product does not extract medication schedules automatically → can explain why in one sentence without hesitation

**V2 starts when:**
Translation accuracy is high enough that test criterion 1 passes consistently across three different document types.

---

## V2 — Extraction

**Status:** 📋 Planned

**Core job:**
Medications, timings, and care tasks are automatically extracted from translated documents. Nothing requires manual entry. DocumentAction promotes to PendingTask automatically.

**What it adds:**
- Automatic medication identification from prescriptions
- Medication timing extraction (before meals, twice daily, etc.)
- Automatic DocumentAction → PendingTask promotion for ongoing obligations
- Care checklist generated from discharge summary
- EpisodeSummaryHistory — archive of previous summary versions
- Eka Care API integration (if developer access granted) — structured document parsing replaces raw Claude upload

**Why this is V2 and not V1:**
Medication extraction must be accurate enough that nothing gets missed. That accuracy is only possible after the translation layer is working correctly — you can't extract reliably from documents you haven't learned to read well.

**Exit criteria — V2 is done when:**
1. Upload a prescription → medication list, timings, and duration appear automatically without manual input
2. Coordinator confirms extracted tasks match what the doctor actually prescribed
3. Miss rate on medication extraction: zero on a 10-document test set

**V3 starts when:**
The structured record from V2 is accurate enough to answer spoken questions reliably.

---

## V3 — Language + Voice

**Status:** 📋 Planned

**Core job:**
The patient speaks a question. The product answers from their own records in plain language they can hear — in their preferred Indian language — without navigating a screen.

**What it adds:**
- Sarvam AI Mayura — regional language translation of all outputs (22 Indian languages)
- Sarvam AI Saaras — speech-to-text (patient speaks a question)
- Sarvam AI Bulbul — text-to-speech (product answers in patient's language)
- User `preferred_language` field drives both translation and voice
- ABDM integration exploration — consent-based record access for hospitals that support it

**Why language and voice solve together (not separately):**
Sarvam AI handles both translation and voice natively for Indian languages. Building them separately would mean integrating Sarvam twice. V3 is one integration that unlocks both capabilities.

**Apply to Sarvam Startup Program when V1 ships:**
6–12 months of API credits for eligible early-stage companies building multilingual AI applications.
Contact: https://dashboard.sarvam.ai/developer

**Exit criteria — V3 is done when:**
1. Patient with `preferred_language: kn` (Kannada) asks a spoken question and receives a spoken Kannada answer from their own records
2. Answer accuracy matches V2 English output quality

---

## Future Considerations (not versioned yet)

**Multi-patient coordinator support:**
One coordinator managing multiple patients simultaneously (elderly parents, multiple family members). Requires dashboard redesign around coordinator-first navigation.

**Shared coordinator access:**
Multiple family members coordinating for the same patient, each with their own account. PatientAccess table already supports this — UI work only.

**Insurance claim tracking:**
Dedicated insurance claim workflow — document submission, status tracking, dispute escalation. Currently a PendingTask category. May warrant its own feature in V4.

**Export to PDF:**
Generate a clean PDF of the full episode summary and document translations. Useful for second opinions and future hospital visits.

**ABDM integration:**
Consent-based access to records directly from ABDM-registered hospitals. Requires hospital-side adoption. Currently blocked by incomplete hospital ecosystem. Earliest V3.
