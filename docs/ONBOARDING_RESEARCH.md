# Onboarding & Multi-Profile Research — Competitive Scan

**Date:** 2026-07-02
**Why this exists:** CareAlign currently has zero onboarding (confirmed by code audit — see "Current State" below) and the product's real ambition is broader than one coordinator managing one patient's single hospitalisation: the goal is a place where a user can see health records for **themselves and their family members** in one place, not scattered across apps. This doc researches how existing products (Indian healthtech primarily, global patient portals and caregiver tools secondarily) solve role separation, first-run onboarding, invite/connection flows, and — most importantly — multi-person record management, so we can decide what to build with evidence instead of guesswork.

Research was done live via web search on 2026-07-02 by two independent agents (India-primary, global/caregiver-secondary). Every claim below is source-cited in the full agent transcripts; this doc condenses to what's decision-relevant. Where a claim could not be verified, the original research says so explicitly — treat unmarked claims as reasonably confirmed and anything below marked **(unverified)** with appropriate skepticism.

---

## Current state of CareAlign (from code, not memory — verified 2026-07-02)

- `app/page.tsx` redirects unconditionally to `/login`. No landing page, no auth-state branching.
- Signup (`app/(auth)/register/page.tsx`) collects name/email/password only, hardcodes `role: 'coordinator'`. No patient self-signup exists. On success, `actions/auth.ts` redirects straight to `/dashboard` — no welcome step.
- Coordinator's first screen (`DashboardContent.tsx`) is a bare form: "Add your first patient," one sentence of guidance, then the form. No explanation of episodes, documents, the AI pipeline, or how to invite a patient.
- Patients never sign up. They redeem a link+PIN at `/join/[token]`, seeing only error states or a bare PIN form — no copy explaining what CareAlign is. They land on `/patient/[patientId]` with just hospital name, episode date, and tabs.
- Zero files/components anywhere named onboarding/welcome/tour/walkthrough (confirmed via full-repo grep).
- **Schema already supports multi-patient access per user**: `patient_access` (`user_id`, `patient_id`, `role`, unique on the pair) has no constraint limiting one user to one patient. `lib/dal/patients.ts:69-85` (`getCoordinatorPatients`) already lists **all** patients a coordinator has access to, sorted by pin/recency — this is the coordinator-side "family vault" list, already built.
- **The gap is patient-side and UI-side, not schema-side**: `lib/dal/patients.ts:42-53` (`getFirstPatientId`) grabs only the single most-recent `patient_access` row for a patient-role user — there is no list view or switcher for a user who has patient-role access to more than one patient record (e.g., someone tracking both their own and a parent's hospitalisation). The route `/patient/[patientId]` also assumes one active patient in context, not a "my family" list.

---

## What each competitor actually does

### India-primary (most relevant market context)

| Product | Role separation | Onboarding | Invite/connect mechanism | Family/multi-profile support |
|---|---|---|---|---|
| **Practo** | Separate apps (consumer vs. Practo Pro for doctors) | Not verifiable | No separate profile — family members are just a name/age typed in at consult time | **Shallow.** Up to 3 "family members" under Practo Plus, but they're not separate records — just details typed in per-consult, capped at 3, no switcher, no independent record set |
| **EkaCare** | Separate apps (consumer vs. Eka Doc for clinicians) | Not verifiable | ABHA (Aadhaar-based) creation/linkage for record portability | **Strongest India example.** Explicit marketing + user testimonial: "segregate all the medical records member wise" — one account, multiple family member profiles, each with its own document set. Exact add/switch UI mechanics not documented anywhere found |
| **Tata 1mg** | Separate apps | Not verifiable | Not found | **None found** — despite being a likely ABHA integrator, the app's own description shows no family-profile feature at all |
| **Apollo 24/7** | Separate apps (consumer vs. Apollo Doctor 247) | Not verifiable | **Support-ticket only** — adding a family member requires filing a request with their name + DOB, not self-service | **Partial.** A "toggle the patient profile" switcher confirmed to exist in support docs, but *adding* a member is manual/support-mediated, not instant |
| **mfine** | Fragmented (3+ separate apps incl. a distinct care-team app) | Phone + OTP, high-level only | Coverage-plan model (up to 6 family members per plan) | **Coverage-plan, not profile-based** — same shallow pattern as Practo |
| **DocsApp** | N/A — **shut down Dec 2022**, merged into MediBuddy | — | — | MediBuddy (successor) supports structured dependents (spouse/parents/4 children) in **corporate enrollment** context; consumer-app mechanics unverified |
| **DocOnline** | Separate from MediBuddy (common misconception — different company) | Not verifiable | Not verifiable | Coverage-plan model ("self and immediate family"), not profile-based |
| **Portea** | Fragmented staff apps; **consumer app appears defunct since 2017** | N/A | Portea ID via email, phone/web booking | **None** — service-coordination for elder/home care, not a digital record vault |

**Key finding on ABHA specifically** (since it's the obvious "use national infra" answer): ABHA is a **per-individual** ID, not a household account. A parent creates a *separate* ABHA per family member by repeating the full registration each time — there's no native "household" grouping. A delegated-access "nominee" feature is referenced in secondary sources as "still in progress" and unverified/undated on official ABDM properties. **This confirms — it doesn't just permit — CareAlign's existing Hard Rule 10 boundary excluding ABDM/Eka Care integration from V1**: even the most ABHA-native competitor (EkaCare) built its family-vault UX as its *own* product feature, segregating records member-wise inside its own account model, not by relying on ABHA to represent the family relationship. We should do the same — model family relationships in our own `patient_access` table (which already supports it), not wait on or build against ABHA.

### Global / caregiver-specific (secondary, for onboarding & invite-flow patterns)

| Product | Role separation | Onboarding | Invite/connect mechanism | Family/multi-profile support |
|---|---|---|---|---|
| **MyChart (Epic)** | One app, proxy-access model | Activation-code gated (friction point per reviews); no in-app tour | Two mechanisms: (1) **Proxy access** — formal request reviewed/approved by hospital staff, persistent; (2) **Share Everywhere** — one-time 60-min code + DOB, no account needed for recipient | **Best-in-class reference.** Age-gated (0–11 full access, 12–17 restricted, 18 auto-revokes), multiple people can hold proxy to the same chart independently, **"Switch" menu** toggles between your own chart and any chart you have proxy to, subject-initiated revocation via "Stop Sharing My Record" |
| **CareZone** | One app, "helper" invite model | Lightweight (email-only signup per one source, unverified) | Owner invites "helpers" (family/professional caregivers) to a specific person's profile | Explicitly built for tracking **multiple people** under one login (self and/or family); helper permissions are per-profile |
| **One Medical** | One app, but **no shared-profile model at all** | Not verifiable | Family memberships purchased separately, each gets **fully separate login** | **Negative example.** No account switcher — must log out/in with a different email to manage a child's account |
| **Zocdoc** | Separate patient/provider portals | Not verifiable | Booking-time only; "family members" saved as reusable name/DOB entries, not linked records | **Address-book convenience only**, not a records system — no persistent grant, no revocation, notifications go only to the primary account |
| **Ada Health** | One app | Verified account-creation steps; no guided tour found | Primary user creates "secondary profiles" directly — no invite/accept step for the other person | Secondary profiles for dependents under 16 (self-attested guardian status, no verification) — closer to "adding an entry" than a mutual/shared arrangement |
| **CaringBridge** | One product, author/follower roles | Explicit **4-step linear onboarding**: register → personalize → set privacy → post | Share link, bulk email invite, Google Contacts import | Journal/broadcast tool, not a records system — not a relevant multi-profile analog |
| **Lotsa Helping Hands** | One product, Leader/Coordinator/Member roles | Marketed as "~60 seconds" to create a community | Leader/Coordinator invites unlimited people | Task/calendar coordination per care-recipient community, not a records vault |

---

## Synthesis: what this means for CareAlign

**1. Onboarding checklist pattern is well-supported across the board.** MyChart, CaringBridge, and Lotsa Helping Hands all either use or market a short linear step sequence (CaringBridge's is the clearest: 4 explicit labeled steps). None of the researched apps use a heavy interactive product tour — the pattern that recurs is a **short checklist tied to real setup actions** (create account → personalize/add first record → set access/privacy → invite someone), not a tooltip walkthrough over a live UI. This fits CareAlign's existing component primitive constraints (Hard Rule 4) better than a tour widget would — a checklist can be built from existing composites without new primitives.

**2. The invite/connect flow should mirror MyChart's proxy-access model, adapted down.** MyChart's two-tier design (persistent proxy access with approval, vs. a one-time no-login-needed share) maps well onto CareAlign's two real invite needs:
   - **Coordinator → patient invite** (already exists via `PatientInviteButton` + PIN) is structurally similar to MyChart's proxy-request-and-approve pattern, just self-approved instead of staff-approved (appropriate since CareAlign has no institutional gatekeeper). The gap is entirely the *missing explanatory copy* on the receiving end (`/join/[token]` shows only error/form states, never "here's what CareAlign is").
   - **A second coordinator joining the same patient** (e.g., two siblings coordinating one parent's care) is exactly MyChart's "both parents get independent proxy access to the same child" pattern — and `patient_access` already supports multiple coordinator rows per patient (`getPatientAccessCount` in `lib/dal/patients.ts:55-63` already counts coordinators per patient), so this is a UI-only gap, not a schema gap.

**3. The "family vault" ambition is closest to EkaCare's model (member-segregated records under one account) and MyChart's "Switch" menu (UI for moving between people you have access to) — and CareAlign's schema already supports both.** No new tables are needed to let one patient-role user see multiple patients' records: `patient_access` already permits multiple rows for one `user_id`. What's missing is purely on the read/UI side:
   - `getFirstPatientId` (`lib/dal/patients.ts:42-53`) needs a sibling function returning *all* patient-role access rows for a user, not just the most recent.
   - The patient-side layout/routes need a "my people" list + switcher, mirroring what `getCoordinatorPatients` already renders for coordinators — this is largely parity work, not new architecture.
   - Apollo 24/7's manual/support-ticket-mediated "add a family member" flow, and One Medical's "no switcher, separate logins" model, are the two clearest **anti-patterns** to avoid — both create exactly the friction the user is trying to eliminate.

**4. Do not build against ABHA for V1.** This is already excluded by Hard Rule 10, and the research independently confirms why: ABHA is per-individual, has no native household grouping, and its one delegated-access feature is unverified/unshipped. Even ABHA-native EkaCare built family segregation as its own feature, not via ABHA. No reason to revisit this boundary.

---

## Open questions for product decision (not decided by this research)

This doc is research, not a plan — the following need your sign-off before any implementation work starts, per the CLAUDE.md stop-condition for schema/scope changes:

1. **Scope of "family vault" for V1**: is extending the *patient* side to support multiple linked patients (mirroring what coordinators already have) in scope now, or should onboarding be fixed first for the current single-patient model, with the vault as a follow-on phase?
2. **Second-coordinator invite flow**: should this be built now (schema already supports it, only UI is missing), or deferred?
3. **Onboarding checklist scope**: coordinator-side only, patient-side only, or both in one pass?
4. **Explanatory copy on `/join/[token]`**: this is the cheapest, highest-leverage fix found (zero schema/architecture change, pure copy + a card) — worth doing as a first, isolated step regardless of the other decisions above?
