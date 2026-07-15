# Patient Coordinator — Product Spec

> Every line in this document was earned through reasoning, not generated. Each decision traces back to a real experience or a deliberate choice with a written rationale.

---

## Problem Statement

The patient and their coordinator need coherence between documents, procedures, and bills for a connected picture while it's happening — across departments, across hospitals — for understanding now and reference later.

---

## The Two Users

### Coordinator
Running alone between departments managing documents, procedures, bills, and insurance. Responsible for everything but given no organised picture of what is happening or what comes next.

**The specific experience this product was built from:**
Managing a parent's hospitalisation — booking ward admission, carrying identification and insurance documents, running between diagnostic labs, billing counters, and nursing stations simultaneously, while also managing work obligations.

**Their core anxiety:**
Being away from the hospital and not knowing if something crucial is being missed.

### Patient
Aware only of what is happening seconds before it happens. Has questions and fears with no one to ask until the doctor appears at an unknown time.

**Their core need:**
To understand what is happening to them — not guess. To have questions answered from their own records without navigating a screen or waiting for a professional.

---

## The Moment That Matters

The coordinator is away from the hospital managing work. Medication timings, health checks, nurse follow-ups are scattered across:
- Verbal instructions from nurses
- Loose slips from each department
- Formal hospital records

They need to know — right now, without being physically present:
1. What does my family member need in the next few hours?
2. Has it happened?
3. Is anything being missed?

---

## What It Does

**For the coordinator:**
Keeps track of all required patient proceedings including next steps — so they do not have to be afraid of missing something crucial while away from the hospital.

**For the patient:**
Answers questions about their current status in plain language — so they do not have to wait on someone for their doubts to get answered.

---

## What It Does NOT Do — V1

1. Find doctors or hospitals
2. Sync with hospital systems or pull records automatically
3. Predict or recommend next steps based on medical data
4. Extract medications or build care checklists automatically — that is V2
5. Surface actions or tasks when there are none — **silence is a valid state**
6. Build its own document storage infrastructure, medical knowledge base, or compliance layer
7. Support regional languages — that is V3

**Why these boundaries exist:**
Each item on this list is a real capability that would be useful — eventually. They are excluded from V1 because they would either require infrastructure dependencies that block shipping (hospital API access, ABDM integration) or solve a secondary problem before the primary one is validated (extraction before translation works perfectly, voice before the record is structured correctly).

---

## The AI's Role — V1

The AI takes medical jargon and turns it into plain language so the patient and coordinator understand exactly what is being provided for treatment — rather than guessing.

**Specifically:**
1. Classify the document type (prescription / lab report / discharge summary / bill / observation note)
2. Translate the document into a structured plain-language output:
   - What this document is
   - What it means for the patient in plain language
   - What (if anything) needs to happen because of it, and for whom
3. Regenerate the episode summary incorporating the new document

**What the AI is not doing:**
- Not generating medical advice
- Not predicting outcomes
- Not recommending treatments
- Not replacing clinical judgment

The AI is a translator, not a clinician.

---

## Roadmap

### V1 — Translation
Documents become plain language the patient and coordinator actually understand.

**Done when:**
1. Upload a prescription, a diagnostic report, and a discharge summary — patient reads the output and tells the coordinator what they need to do tomorrow without any explanation required
2. One person who has been a hospital coordinator opens the product without instructions and finds it useful within 5 minutes
3. The product does not extract medication schedules automatically — that is V2 — and this can be explained in one sentence without hesitation

### V2 — Extraction
Medications, timings, and care tasks pulled automatically from translated documents into a coordinator checklist. DocumentAction promotes to PendingTask automatically. Nothing requires manual entry.

**V2 starts when:**
Translation in V1 is accurate enough that the patient reads the output and tells the coordinator what they need to do tomorrow — without explanation — across three different document types: prescription, diagnostic report, and discharge summary.

### V3 — Language + Voice
- Sarvam AI Mayura for regional language output (22 Indian languages)
- Sarvam AI Saaras + Bulbul for voice interaction in preferred language
- User preferred_language field drives both
- Patient speaks a question — product answers from their own records in plain language they can hear without navigating a screen

**Why language and voice solve together:**
Sarvam AI handles both translation and voice natively for Indian languages. Building them separately would mean integrating Sarvam twice. V3 is one integration that unlocks both capabilities.

---

## Technical Foundation — V1

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js 16 App Router (React 19.2) | Production experience, Vercel-native, server components |
| Language | TypeScript | Type safety across AI schema boundaries |
| UI | Shadcn/UI + Tailwind | Existing familiarity, composable primitives |
| Database | Supabase (Postgres) | Existing experience, RLS for user data isolation |
| File storage | Vercel Blob | Vercel-native, simple API, file_key pattern |
| AI | Claude API via Vercel AI SDK | Structured output, Zod schema, streaming support |
| Auth | Supabase Auth | Built-in, integrates with RLS |
| Deployment | Vercel | Zero-config, Edge functions |

**No external health API in V1.**
Eka Care API access being pursued in parallel — if granted before V1 ships, their document parsing SDK replaces the raw Claude upload call. If not, V1 ships without it.

---

## Competitive Context

| Product | What it does | What it doesn't do for this use case |
|---------|-------------|--------------------------------------|
| Eka Care | Record storage, ABHA integration, AI healthbot | Not built for the coordinator role during active hospitalisation. Family member is secondary, not primary user. |
| Patiently AI | Single document translation | No memory, no continuity, no connected picture across an episode |
| ABHA | Government health ID and record access | Storage and access only — no comprehension layer. Hospital adoption incomplete. |

**The gap that remains:**
A product built for the coordinator-patient pair during an active, time-bounded hospitalisation episode — that takes everything generated in that episode across departments, translates it into plain language, and organises it as a coherent story both can understand and refer back to.
