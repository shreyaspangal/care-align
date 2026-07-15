# 02 — Current User Flow (as implemented)

> Phase 2 of the wedge-discovery analysis. This documents what a user **actually experiences** in the deployed code — real routes, real components, real dead-ends — not the idealised flow in SPEC.md.
>
> **Rewrite-aware framing (decided after Phase 1):** the owner has stated an inclination to rebuild from scratch; the profile-based naming direction was an undocumented decision the code never followed. This document therefore serves as the record of *what a rebuild replaces*, kept lean. Verdicts on what to salvage belong to Phase 3; this file is observation only.

---

## 0. The two personas the code actually serves

Despite ADR-013 removing account-level roles, the flow is still written for exactly two per-record roles:

- **Coordinator** — the person managing someone else's hospitalisation. Every entry path except the invite link produces this persona.
- **Patient** — the person whose record it is. The *only* way to become one is to redeem an invite link created by a coordinator.

There is no path where a person starts by managing *their own* health record as a first-class flow — the register copy literally says "organising your **patient's** health records," and the form posts a hidden `role=coordinator` field (`app/(auth)/register/RegisterForm.tsx:52`).

---

## 1. Entry: there is no front door

| Step | What happens | Where |
|------|--------------|-------|
| Visit `/` | Immediate `redirect('/login')` — no landing page, no product explanation, no signup pitch | `app/page.tsx` |
| Any other URL, no session | `proxy.ts` redirects to `/login` (only `/login`, `/register`, `/join/*` are public) | `proxy.ts:51-58` |
| Visit `/login` or `/register` with a session | `proxy.ts` fetches the user's `patient_access` rows and redirects to `resolveHomePath()`: exactly one record → straight into it; zero or many → `/dashboard` | `proxy.ts:60-67` |

**Observed:** a brand-new visitor who is not already convinced has nothing to read. The decided landing-page IA (CONTENT_LOG, June) was never built. Acquisition currently requires the user to arrive pre-sold or via an invite link.

## 2. Registration → first record

1. `/register` — name, email, password. No email verification gate is visible in the flow; the hidden `role` field is hardcoded to `coordinator`.
2. On success → `/dashboard`. With zero records, `DashboardContent` renders a **full-screen "Add your first patient" form** (name, DOB, etc. via `CreatePatientForm`) — this is the closest thing to onboarding that exists. No explanation of episodes, uploads, or invites precedes it.
3. `actions/create-patient.ts` inserts the `patients` row via the **service-role client** (chicken-and-egg with RLS), then inserts the creator's `patient_access` row as `coordinator` with `provenance = 'coordinator_attested'`.
4. → `/dashboard/{patientId}` .

With ≥1 record, `/dashboard` shows **"Your people"** — a searchable list of linked records, each badged `You manage` / `Your care` + admission status (`DashboardContent.tsx:41-101`). A separate `/dashboard/new` page exists for adding subsequent patients.

## 3. Inside a record — one route tree, role-branched

`app/(app)/dashboard/[patientId]/layout.tsx` is the single per-record gate:

- No `patient_access` row → friendly "Your access to this care record has ended." (not a 404 — deliberate, supports revocation UX).
- **Coordinator variant:** back-link "All patients", patient name header, and three header actions — `RevokeAccessButton` (revoke the patient's own access; only shown if a patient-role row exists), `PatientInviteButton` ("Share with patient"), `SelfRevokeCoordinatorButton` ("Leave"). Tabs: **Documents / Summary / Tasks**.
- **Patient variant:** hospital name + episode start date as header (derived, oddly, from the first document that has a `source_hospital`). Tabs: **Documents / Summary / Access** (no Tasks).

The tab set is one component (`PatientTabNav`) taking a `role` prop — the ADR-013 unification is real here.

## 4. The core loop: episode → upload → AI → summary/tasks

Coordinator on the **Documents** tab (`[patientId]/page.tsx`):

1. No active episode → dashed empty state + `CreateEpisodeButton`. (Episodes are created manually; nothing creates one automatically.)
2. With an episode → `DocumentUploadZone`. Upload triggers the full synchronous pipeline in `actions/upload-document.ts`: validate (MIME/size) → rate limit (10/hr/user, Upstash) → Vercel Blob → `documents` row (`pending_classification`) → Claude classify (`classified`) → Claude translate → `document_translations` + `document_actions` + `pending_tasks` (`translated`) → episode summary regeneration (non-fatal).
3. **The user waits through all of it** — ADR-007's synchronous choice means the upload UI blocks until classify + translate + summary complete (three sequential LLM calls). Failure at any step → `status='failed'`, record kept.
4. Uploaded documents render in `DocumentsSection` with type tags, translation status, delete action; the file itself is served only through `/api/documents/[documentId]/file` (auth check → 302 to a short-lived signed Blob URL).

**Summary tab:** coordinator sees `EpisodeSummaryPanel` (AI-regenerated living summary + open-task counts + episode status controls). Patient sees `PatientSummaryPanel` + a **"What you need to do"** list built from patient-facing `document_actions` — with the honest empty state "Nothing yet — your coordinator is reviewing your documents" (Hard Rule 9: silence is valid).

**Tasks tab (coordinator-only, `notFound()` for patients):** `TasksClient` lists `pending_tasks` split by phase (`during_care` / `post_discharge`), post-discharge auto-shown once the episode reaches `care_complete`/`closed`; tasks resolve via `resolveTask`.

**Known break in this loop (Phase 1 finding, restated):** `upload-document.ts` queries `patients(profiles(name))` — a FK path that doesn't exist — so every AI prompt runs with "the patient" instead of the real name, and when the embed errors, `revalidatePath` is skipped and the UI shows stale data after upload.

## 5. The invite flow — the most India-specific thing in the product

**Creation (coordinator):** `PatientInviteButton` dialog, two explicit modes:
- **Require access code (recommended, default):** generates a one-time link + a 6-digit PIN (bcrypt-hashed at rest). The UI itself scripts the delivery ritual: *"Step 1 — Share this link via WhatsApp. Step 2 — Call the patient and tell them this code."* PIN shown once, never again.
- **Direct access, no code:** requires ticking an "I understand anyone with this link…" confirmation.
Generating a new invite expires prior unused ones (`create-invite.ts:51-54`).

**Redemption (`/join/[token]`, public):** the page branches on invite validity (invalid / expired / PIN-locked after 5 wrong attempts → each gets a distinct friendly error telling them to ask their coordinator for a new link), then on session state:

| Visitor | PIN invite | No-PIN invite |
|---------|-----------|---------------|
| Logged in, already has access | → `/dashboard/{patientId}` directly (token untouched) | same |
| Logged in, no access | PIN entry form (session ≠ identity proof) | auto-redeem → record |
| Anonymous | PIN entry form | **`signInAnonymously()`** auto-join — zero-friction, no account creation (`join-as-patient.ts:136`) |

Redemption is race-safe (`WHERE used_at IS NULL` single-winner update, with rollback if the subsequent access insert fails) and writes `patient_access` with `provenance='self_consented'`.

**Observed:** this is a complete, thoughtfully-designed acquisition mechanism for a low-digital-literacy second user — WhatsApp link + voice-call PIN + anonymous session. It is also currently the **only** viral/expansion loop in the product, and it only flows coordinator → patient.

## 6. Revocation — designed bilateral, effectively unilateral

- **Patient revokes coordinator:** the patient-only **Access** tab lists everyone with coordinator access and offers revoke, independent of who granted it (`access/page.tsx`, backed by real RLS DELETE policies).
- **Coordinator revokes patient:** `RevokeAccessButton` in the record header.
- **Coordinator leaves ("self-revoke"):** guarded by `coordinatorCount <= 1` — and since **no second-coordinator invite flow exists**, every record has exactly one coordinator, so the Leave button errors for essentially every user. The code comments acknowledge this is expected.

## 7. Dead-ends and silent moments (the flow's honest shape)

1. **No landing page** — `/` is a login redirect; the product cannot explain itself to a stranger.
2. **No onboarding** — first-run is a bare patient-creation form; episodes/uploads/invites are never introduced.
3. **The product only answers when opened.** There is no notification, email, digest, or push layer anywhere. SPEC.md's core emotional moment — the coordinator *away from the hospital* wondering "is anything being missed?" — has no inbound channel; the user must remember to visit.
4. **Patients are read-only.** A patient cannot upload a document to their own record, cannot see Tasks, cannot create episodes. For records where the "patient" is a capable adult managing themselves, the product has no shape.
5. **Second coordinator is impossible** — no invite path grants coordinator role; family co-management (the stated family-vault direction) is structurally absent.
6. **Anonymous joiners are stranded on a device.** `signInAnonymously()` means the patient's access lives in one browser's session; there is no visible path to upgrade to a real account (JoinForm sign-up exists only on the *no-PIN* path before joining, not after).
7. **Episode end is manual and consequence-free** — status changes flip task visibility but nothing archives, exports, or summarises an episode's conclusion for the family.

## 8. Flow-level material for the wedge search (carried to Phase 5)

- The invite ritual (WhatsApp + phone-call PIN) is a **distribution design**, not just a security feature — it encodes how Indian families actually coordinate. Salvageable regardless of rebuild.
- The flow's centre of gravity is the *coordinator during an active hospitalisation* — every screen assumes an episode in motion. The quiet periods between episodes (where most of family health management actually lives) have zero surface.
- The absence of any notification layer is the single largest gap between the flow as built and the anxiety it claims to serve.
- The unified "Your people" list + per-record roles is the correct skeleton for any family-vault direction and survived the messy naming — the *model* is right even where the *names* are not.
