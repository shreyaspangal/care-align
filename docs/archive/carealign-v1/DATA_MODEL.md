# Patient Coordinator — Data Model

> Every field in this schema was reasoned through from the actual hospitalisation experience that produced this product. No field exists without a rationale. No field was added because "it might be useful."

---

## Navigation — Where to Look When Confused

| Question | Go to |
|----------|-------|
| What fields does a table have? | `supabase/migrations/20240101000000_initial_schema.sql` — Section 3 |
| Who can read/write this table? | Same file — Section 5 (search `ALTER TABLE <name> ENABLE`) |
| How does a new user get a profile? | Same file — Section 4 (`handle_new_user` trigger) |
| How does version increment safely? | Same file — Section 6 (`upsert_episode_summary` RPC) + `lib/db/episode-summaries.ts` |
| Full ER diagram with rationale | This file |
| Which component uses which data? | `docs/COMPONENT_PLAN.md` |
| AI pipeline step order | `CLAUDE.md` — AI Pipeline section |

---

## Design Principles

1. **Soft deletes everywhere** — health data is never hard deleted. `deleted_at` is nullable on every entity. All queries filter `WHERE deleted_at IS NULL`.
2. **Postgres enum types** — all categorical fields use database-level enum types, not free text strings.
3. **File keys, not URLs** — Vercel Blob storage paths are stored as keys, not full URLs. Full URL constructed at query time. Storage-provider-independent.
4. **Explicit indexes** — every foreign key and every frequently filtered field has an explicit index.
5. **UUID primary keys** — all entities use `uuid` as primary key, not serial integers.
6. **INR assumption** — all monetary values are decimal, INR assumed. V1 is India-only. Comment noted in schema.
7. **No sensitive government IDs** — Aadhaar and PAN numbers are not stored. DPDP Act compliance by design.

---

## Postgres Enum Types

```sql
CREATE TYPE user_role AS ENUM ('coordinator', 'patient');

CREATE TYPE admission_status AS ENUM ('admitted', 'outpatient');

CREATE TYPE episode_status AS ENUM ('active', 'care_complete', 'closed');
-- active:         patient is still receiving care
-- care_complete:  medically done, administrative tail still open
-- closed:         everything resolved, patient home

CREATE TYPE document_type AS ENUM (
  'prescription',
  'lab_report',
  'discharge_summary',
  'bill',
  'observation_note',
  'other'
);

CREATE TYPE action_for AS ENUM ('coordinator', 'patient', 'both');

CREATE TYPE action_status AS ENUM ('open', 'resolved');

CREATE TYPE task_category AS ENUM (
  'insurance',
  'medication',
  'doctor_visit',
  'lifestyle',
  'test_results',
  'forms',
  'payment'
);

CREATE TYPE task_phase AS ENUM ('during_care', 'post_discharge');

CREATE TYPE task_status AS ENUM ('open', 'resolved');

CREATE TYPE preferred_language AS ENUM (
  'en', 'hi', 'kn', 'ta', 'te', 'ml', 'other'
);
-- V1: en only used. Other values stored for V3 Sarvam AI integration.

CREATE TYPE document_status AS ENUM (
  'pending_classification',
  'classified',
  'translated',
  'failed'
);
-- pending_classification: file uploaded to Blob, no Claude call made yet
-- classified:             Step 1 complete, type/name/purpose confirmed
-- translated:             Steps 1+2 complete, DocumentTranslation record exists
-- failed:                 Any Claude step failed; document is orphaned — user must retry

CREATE TYPE patient_access_provenance AS ENUM ('self_consented', 'coordinator_attested');
-- self_consented:       the access-holder redeemed a patient_invites token themselves
-- coordinator_attested: a coordinator created the row asserting authority on the
--                       patient's behalf, without the patient's direct action
```

---

## Entities

### Profile
Extended user data for the person using the product. Supabase Auth manages authentication in `auth.users`. `profiles` extends that with application-level fields (name, role, language). One-to-one with `auth.users`.

```sql
CREATE TABLE profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Mirrors auth.users.id exactly. No separate gen_random_uuid().
  name                TEXT NOT NULL,
  role                user_role NOT NULL,
  preferred_language  preferred_language NOT NULL DEFAULT 'en',
  -- V1: en only. V3: Sarvam AI uses this for translation + voice output.
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_role ON profiles(role);
```

**Why `profiles` and not `users`:**
Supabase Auth already owns an `auth.users` table. Creating a second `public.users` table causes them to drift — a user who signs up has a record in `auth.users` but nothing in `public.users`, so every profile query returns null. The `profiles` pattern is the Supabase standard: extend auth, don't duplicate it.

**Auto-create profile on signup — required:**
Without this trigger, a new signup has auth credentials but no profile record, and the application breaks on first load.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Unknown'),
    (NEW.raw_user_meta_data->>'role')::user_role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

The `name` and `role` fields are passed as metadata during signup:
```typescript
// actions/auth.ts
await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { name, role }  // picked up by the trigger
  }
})
```

**Why preferred_language on Profile and not Patient:**
The coordinator also has a language preference for their own view. Language is a user attribute, not a patient attribute.

---

### PatientAccess
Links users to patients with explicit roles. Supports multiple coordinators for one patient, and one user holding access to multiple patients — this is the table that makes the unified access model possible: "coordinator" is a permission on a specific `(user_id, patient_id)` pair, not an account-wide type.

```sql
CREATE TABLE patient_access (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id),
  patient_id   UUID NOT NULL REFERENCES patients(id),
  role         user_role NOT NULL,
  pinned_at    TIMESTAMPTZ,
  provenance   patient_access_provenance NOT NULL,
  invite_id    UUID REFERENCES patient_invites(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, patient_id)
);

CREATE INDEX idx_patient_access_user_id     ON patient_access(user_id);
CREATE INDEX idx_patient_access_patient_id  ON patient_access(patient_id);
CREATE INDEX idx_patient_access_provenance  ON patient_access(provenance);
CREATE INDEX idx_patient_access_invite_id   ON patient_access(invite_id);
```

`provenance` is `patient_access_provenance` (`'self_consented' | 'coordinator_attested'`, see enum table below) — added in `20260702000000_patient_access_provenance_and_revocation.sql`. It records *how* a grant came to exist, deliberately never collapsing the two cases: `self_consented` means the access-holder redeemed a `patient_invites` token themselves (always `role = 'patient'` today); `coordinator_attested` means a coordinator created the row asserting authority on the patient's behalf, typically because the patient couldn't act for themselves at that moment (always `role = 'coordinator'` today, tagged at the same insert in `actions/create-patient.ts` that bootstraps the patient record). `invite_id` links a `self_consented` row back to the invite that created it.

**Why this exists:**
During the hospitalisation, multiple family members may need access. The patient themselves also needs access — as a different role. PatientAccess makes this explicit and queryable. It's also the sole gate the app-level route consolidation relies on: `app/(app)/dashboard/[patientId]/*` is one route tree for every role, and every page/layout under it calls `getPatientAccess(patientId)` to decide what to render — there is no separate route tree per role anymore.

---

### PatientInvite
A one-time-use, expiring link (optionally PIN-protected) a coordinator generates so a patient can redeem `role = 'patient'` access to their own record without the coordinator needing to know their email in advance.

```sql
CREATE TABLE patient_invites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token         TEXT NOT NULL UNIQUE DEFAULT ...,  -- random, unguessable
  patient_id    UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  created_by    UUID NOT NULL REFERENCES auth.users(id),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  used_at       TIMESTAMPTZ,
  used_by       UUID REFERENCES auth.users(id),
  pin_hash      TEXT,       -- bcrypt hash; NULL means no-PIN "direct access" link
  pin_attempts  INTEGER NOT NULL DEFAULT 0,
  pin_locked_at TIMESTAMPTZ,  -- set after MAX_PIN_ATTEMPTS (5) wrong guesses; no unlock path
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Why this exists:**
Coordinators frequently don't know the patient's email at creation time (they may be hospitalised, without a phone in hand, or simply not yet using the app). The invite is delivered out-of-band (WhatsApp link + a phone call for the PIN) and redemption is what creates the patient's own `patient_access` row — see `actions/join-as-patient.ts`. Generating a new invite for a patient expires all of that patient's prior pending invites, so only one is ever valid at a time.

**Redemption is not the only source of a `patient_access` row for this patient** — the coordinator's own row is created earlier, at patient creation (`actions/create-patient.ts`), by a completely separate path that never touches this table. `patient_access.invite_id` is only ever populated on `self_consented` rows.

---

### Patient
The person receiving care. Center of everything.

```sql
CREATE TABLE patients (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  date_of_birth           DATE NOT NULL,
  gender                  TEXT NOT NULL,
  blood_group             TEXT,
  insurance_provider_name TEXT,
  -- Provider name only. No policy numbers. DPDP compliance.
  admission_status        admission_status NOT NULL DEFAULT 'admitted',
  deleted_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Why no Aadhaar or PAN:**
These were used at hospital counters for verification — the hospital extracted what they needed from the physical card. Storing these numbers in our database creates DPDP Act obligations we are explicitly avoiding in V1.

**Why no coordinator_id directly:**
Coordinator relationship is managed through PatientAccess, which supports multiple coordinators and explicit role management.

---

### Episode
A time-bounded period of care. One hospitalisation = one episode.

```sql
CREATE TABLE episodes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES patients(id),
  started_at      DATE NOT NULL,
  -- Date of first doctor visit — when the patient entered the system
  care_ended_at   DATE,
  -- Doctor confirms patient is medically clear. Nullable until then.
  admin_ended_at  DATE,
  -- Discharge papers signed, final bill settled. Nullable until then.
  -- Why two end dates: in real experience, a 2-day gap existed between
  -- medical clearance and administrative resolution (insurance dispute).
  -- These are meaningfully different states.
  status          episode_status NOT NULL DEFAULT 'active',
  total_cost      DECIMAL(12,2) DEFAULT 0,
  -- INR assumed. V1 is India-only. No multi-currency support.
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_episodes_patient_id ON episodes(patient_id);
CREATE INDEX idx_episodes_status ON episodes(status);
CREATE INDEX idx_episodes_patient_status ON episodes(patient_id, status);
```

**Why no hospital_name on Episode:**
An episode can span multiple hospitals (second opinion, transfer of care). Hospital belongs on Document, where each document carries the context of where it was generated.

---

### Document
Every physical slip, report, prescription, or bill that gets uploaded. The raw input to the AI pipeline.

```sql
CREATE TABLE documents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id          UUID NOT NULL REFERENCES episodes(id),
  name                TEXT NOT NULL,
  -- Exact name as it appears on the physical document.
  -- Not a generated name. "Complete Blood Count Report" not "blood_test_1"
  type                document_type NOT NULL DEFAULT 'other',
  -- Nullable until Claude classifies. Inserted as 'other', updated after Step 3.
  -- User can confirm or correct after classification.
  purpose             TEXT,
  -- Nullable until Claude classifies. Plain language label: "Pre-operation blood work"
  -- Claude suggests. User confirms. NULL while status = pending_classification.
  source_hospital     TEXT,
  -- Nullable until Claude classifies. NULL while status = pending_classification.
  source_department   TEXT,
  -- Nullable. Sometimes a slip is handed by a nurse with no clear dept.
  document_date       DATE,
  -- Date ON the document. Not the upload date.
  -- A lab report dated 3 days ago is different from one dated today.
  -- Nullable: Claude returns null when date is absent or illegible.
  -- UI should show "Date unknown" when null. Do not default to upload date.
  file_key            TEXT NOT NULL,
  -- Vercel Blob storage key. NOT the full URL.
  -- Full URL constructed at query time: storage.getUrl(file_key)
  -- Storage-provider-independent.
  status              document_status NOT NULL DEFAULT 'pending_classification',
  -- Tracks AI pipeline progress. Allows safe retry on failure.
  -- Never delete a failed document — set status = 'failed' and surface retry UI.
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_episode_id ON documents(episode_id);
CREATE INDEX idx_documents_type ON documents(type);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_episode_type ON documents(episode_id, type);
CREATE INDEX idx_documents_document_date ON documents(document_date);
```

---

### DocumentTranslation
Claude's plain-language output for one document. One-to-one with Document.

```sql
CREATE TABLE document_translations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL UNIQUE REFERENCES documents(id),
  -- UNIQUE enforces one-to-one relationship
  plain_language  TEXT NOT NULL,
  -- What this document says, in plain language the patient can read
  what_it_means   TEXT NOT NULL,
  -- What this means for THIS patient specifically
  prompt_version  TEXT NOT NULL DEFAULT 'v1',
  -- Records which prompt version produced this translation.
  -- Increment when classification or translation prompt is materially changed.
  -- Allows selective re-translation of older documents after prompt improvement.
  -- Format: 'v1', 'v2', ... — match the version logged in AI_BEHAVIOUR.md.
  deleted_at      TIMESTAMPTZ,
  translated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_translations_document_id
  ON document_translations(document_id);
```

**Why separated from Document:**
If Claude needs to re-translate (prompt improvement, model upgrade), the original document record is preserved. Translation is the AI's output — Document is the user's input. They are different things.

---

### DocumentAction
Raw AI output — actions extracted from a document translation. The immutable audit trail.
One translation can produce zero or more actions.

```sql
CREATE TABLE document_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  translation_id  UUID NOT NULL REFERENCES document_translations(id),
  action_for      action_for    NOT NULL,
  -- coordinator: buy medication, submit form
  -- patient:     avoid lifting, follow diet
  -- both:        attend follow-up appointment
  category        task_category NOT NULL,
  -- Derived from document.type at write time — not from Claude output.
  -- See lib/ai/classify-action.ts for the lookup table.
  phase_appears   task_phase    NOT NULL,
  -- Derived from document.type + episode.care_ended_at at write time.
  -- during_care:    episode still active when document was uploaded
  -- post_discharge: care_ended_at was set before document was uploaded
  description     TEXT NOT NULL,
  status          action_status NOT NULL DEFAULT 'open',
  resolved_at     TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_actions_translation_id
  ON document_actions(translation_id);
CREATE INDEX idx_document_actions_status
  ON document_actions(status);
CREATE INDEX idx_document_actions_translation_status
  ON document_actions(translation_id, status);
CREATE INDEX idx_document_actions_phase
  ON document_actions(phase_appears);
CREATE INDEX idx_document_actions_translation_phase
  ON document_actions(translation_id, phase_appears);
```

**Why `document_actions` is the audit trail, not the working list:**
`document_actions` is immutable once written — it records exactly what Claude extracted
from this specific document. It answers: "what did the AI say about this document?"
`pending_tasks` is the coordinator's working list — mutable, resolvable, phase-filtered.
It answers: "what still needs to happen for this episode?"
The `source_action_id` FK on `pending_tasks` preserves full lineage between the two.

**Why both tables carry `action_for`, `category`, and `phase_appears`:**
Both tables must be self-describing. `document_actions` without `category` cannot answer
"what kind of action was this?" without joining `pending_tasks`. `pending_tasks` without
`action_for` cannot filter patient-visible tasks without joining back to `document_actions`.
Each table is independently queryable — no cross-table join required for basic questions.

**Why not flat fields on DocumentTranslation:**
A single document can produce multiple actions for different people. A discharge summary
might have "buy medication X" for coordinator AND "avoid lifting" for patient AND
"attend follow-up in 7 days" for both. Flat fields can only hold one action.

---

### EpisodeSummary
Claude's living synthesis of everything that has happened in the episode. One-to-one with Episode. Regenerated on every document upload.

```sql
CREATE TABLE episode_summaries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id          UUID NOT NULL UNIQUE REFERENCES episodes(id),
  -- UNIQUE enforces one-to-one relationship
  visit_purpose       TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- When the first summary was generated for this episode.
  -- Why the patient came in, plain language
  timeline_summary    TEXT NOT NULL,
  -- Chronological narrative of what happened across all documents
  status_label        TEXT NOT NULL,
  -- Short: "Post-operation, under observation"
  status_description  TEXT NOT NULL,
  -- One sentence: "Dad had the operation on Tuesday, currently resting
  -- in ward 4, doctor visits tomorrow morning"
  version             INTEGER NOT NULL DEFAULT 1,
  -- Increments on every regeneration.
  -- Tells coordinator how many times the summary has been updated.
  deleted_at          TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
  -- updated_at + version together tell the full story:
  -- "Version 4, last updated 3 hours ago"
);

CREATE INDEX idx_episode_summaries_episode_id
  ON episode_summaries(episode_id);
```

**Why silence is valid:**
EpisodeSummary only surfaces actions and next steps when they exist. `status_label` and `status_description` can validly say "Stable, no new developments today." The product does not manufacture tasks to appear useful.

**Version increment pattern — required:**
The `version` field must increment atomically on every update, not be reset to a fixed value. Use an upsert with `version = episode_summaries.version + 1`:

```sql
INSERT INTO episode_summaries
  (episode_id, visit_purpose, timeline_summary, status_label, status_description, version, created_at, updated_at)
VALUES
  ($1, $2, $3, $4, $5, 1, now(), now())
ON CONFLICT (episode_id) DO UPDATE SET
  visit_purpose       = EXCLUDED.visit_purpose,
  timeline_summary    = EXCLUDED.timeline_summary,
  status_label        = EXCLUDED.status_label,
  status_description  = EXCLUDED.status_description,
  version             = episode_summaries.version + 1,
  updated_at          = now();
-- Note: created_at is intentionally excluded from the UPDATE — it must not change.
```

In TypeScript via Supabase client:
```typescript
// lib/db/episode-summaries.ts
export async function upsertEpisodeSummary(
  supabase: SupabaseClient,
  episodeId: string,
  summary: EpisodeSummaryOutput
) {
  const { error } = await supabase.rpc('upsert_episode_summary', {
    p_episode_id: episodeId,
    p_visit_purpose: summary.visit_purpose,
    p_timeline_summary: summary.timeline_summary,
    p_status_label: summary.status_label,
    p_status_description: summary.status_description,
  })
  if (error) throw error
}
```

The `upsert_episode_summary` Postgres function encapsulates the INSERT...ON CONFLICT logic above. Using an RPC prevents the version increment from being accidentally overwritten by a naive `.upsert()` call from the Supabase JS client, which would reset `version` to whatever value is passed in.

---

### PendingTask
The coordinator's working task list. Phase-aware — only surfaces tasks relevant to the
current stage of care. Mutable — tasks are resolved with notes as the episode progresses.

```sql
CREATE TABLE pending_tasks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id       UUID NOT NULL REFERENCES episodes(id),
  source_action_id UUID REFERENCES document_actions(id),
  -- Nullable. Set when promoted from a DocumentAction (V1 pipeline).
  -- Null means the task was created manually by the coordinator.
  -- Enables tracing: "which document produced this task?"
  action_for       action_for    NOT NULL DEFAULT 'coordinator',
  -- Copied from source document_action at promotion time.
  -- coordinator: task only the coordinator sees and acts on
  -- patient:     task the patient sees in their own view
  -- both:        visible to both coordinator and patient
  -- Patient view filters: WHERE action_for IN ('patient', 'both')
  category         task_category NOT NULL,
  description      TEXT NOT NULL,
  -- Plain language: "Submit insurance reimbursement claim for Room 204"
  phase_appears    task_phase NOT NULL,
  -- during_care:    surfaces immediately on creation
  -- post_discharge: only surfaces after care_ended_at is set
  status           task_status NOT NULL DEFAULT 'open',
  resolution_note  TEXT,
  -- Free text. Resolutions are messy and don't fit neat categories.
  -- "Paid ₹12,400 outstanding after insurer covered 60%"
  resolved_at      TIMESTAMPTZ,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pending_tasks_episode_id ON pending_tasks(episode_id);
CREATE INDEX idx_pending_tasks_source_action_id ON pending_tasks(source_action_id);
CREATE INDEX idx_pending_tasks_status ON pending_tasks(status);
CREATE INDEX idx_pending_tasks_phase ON pending_tasks(phase_appears);
CREATE INDEX idx_pending_tasks_action_for ON pending_tasks(action_for);
CREATE INDEX idx_pending_tasks_episode_status
  ON pending_tasks(episode_id, status);
CREATE INDEX idx_pending_tasks_episode_phase_status
  ON pending_tasks(episode_id, phase_appears, status);
CREATE INDEX idx_pending_tasks_episode_actionfor_status
  ON pending_tasks(episode_id, action_for, status);
```

**Why phase_appears matters:**
- `doctor_visit` tasks only make sense post-discharge
- `forms` tasks only exist during hospitalisation
- `insurance`, `medication`, `lifestyle`, `test_results`, `payment` span both
Surfacing all tasks at once creates the same cognitive overload the product is designed to solve.

---

## Entity Relationship Summary

```
auth.users
  └─► Profile
        └─(PatientAccess)─► Patient
                          └─► Episode
                                  ├─► Document
                                  │       └─► DocumentTranslation
                                  │                   └─► DocumentAction
                                  ├─► EpisodeSummary
                                  └─► PendingTask
```

---

## Row Level Security (Supabase RLS)

Every table has RLS enabled. Two access tiers:
- **Coordinator** — full read + write on all entities for their patients
- **Patient** — read-only on `document_translations`, `episode_summaries`, `pending_tasks` for their own record only. Cannot write to any table.

The helper function used in all policies:

```sql
-- Returns true if the calling user has PatientAccess for the given patient_id
CREATE OR REPLACE FUNCTION user_has_patient_access(p_patient_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM patient_access
    WHERE patient_access.patient_id = p_patient_id
    AND patient_access.user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;
```

### patients

```sql
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Coordinators: read + write
CREATE POLICY "Coordinator access to patients"
ON patients FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM patient_access
    WHERE patient_access.patient_id = patients.id
    AND patient_access.user_id = auth.uid()
    AND patient_access.role = 'coordinator'
  )
);

-- Patients: read-only (their own record only)
CREATE POLICY "Patient read-only access to own record"
ON patients FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM patient_access
    WHERE patient_access.patient_id = patients.id
    AND patient_access.user_id = auth.uid()
    AND patient_access.role = 'patient'
  )
);
```

### episodes

```sql
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access episodes for own patients"
ON episodes FOR ALL
USING (user_has_patient_access(patient_id));
```

### documents

```sql
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Coordinators: read + write
CREATE POLICY "Coordinator access to documents"
ON documents FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM episodes e
    JOIN patient_access pa ON pa.patient_id = e.patient_id
    WHERE e.id = documents.episode_id
    AND pa.user_id = auth.uid()
    AND pa.role = 'coordinator'
  )
);
```

### document_translations

```sql
ALTER TABLE document_translations ENABLE ROW LEVEL SECURITY;

-- Coordinators: read + write
CREATE POLICY "Coordinator access to translations"
ON document_translations FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM documents d
    JOIN episodes e ON e.id = d.episode_id
    JOIN patient_access pa ON pa.patient_id = e.patient_id
    WHERE d.id = document_translations.document_id
    AND pa.user_id = auth.uid()
    AND pa.role = 'coordinator'
  )
);

-- Patients: read-only (plain_language + what_it_means only — column-level security handled in app layer)
CREATE POLICY "Patient read-only access to translations"
ON document_translations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM documents d
    JOIN episodes e ON e.id = d.episode_id
    JOIN patient_access pa ON pa.patient_id = e.patient_id
    WHERE d.id = document_translations.document_id
    AND pa.user_id = auth.uid()
    AND pa.role = 'patient'
  )
);
```

### document_actions

```sql
ALTER TABLE document_actions ENABLE ROW LEVEL SECURITY;

-- Coordinators: read + write
CREATE POLICY "Coordinator access to document actions"
ON document_actions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM document_translations dt
    JOIN documents d ON d.id = dt.document_id
    JOIN episodes e ON e.id = d.episode_id
    JOIN patient_access pa ON pa.patient_id = e.patient_id
    WHERE dt.id = document_actions.translation_id
    AND pa.user_id = auth.uid()
    AND pa.role = 'coordinator'
  )
);
```

### episode_summaries

```sql
ALTER TABLE episode_summaries ENABLE ROW LEVEL SECURITY;

-- Coordinators: read + write
CREATE POLICY "Coordinator access to episode summaries"
ON episode_summaries FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM episodes e
    JOIN patient_access pa ON pa.patient_id = e.patient_id
    WHERE e.id = episode_summaries.episode_id
    AND pa.user_id = auth.uid()
    AND pa.role = 'coordinator'
  )
);

-- Patients: read-only
CREATE POLICY "Patient read-only access to episode summaries"
ON episode_summaries FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM episodes e
    JOIN patient_access pa ON pa.patient_id = e.patient_id
    WHERE e.id = episode_summaries.episode_id
    AND pa.user_id = auth.uid()
    AND pa.role = 'patient'
  )
);
```

### pending_tasks

```sql
ALTER TABLE pending_tasks ENABLE ROW LEVEL SECURITY;

-- Coordinators: read + write
CREATE POLICY "Coordinator access to pending tasks"
ON pending_tasks FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM episodes e
    JOIN patient_access pa ON pa.patient_id = e.patient_id
    WHERE e.id = pending_tasks.episode_id
    AND pa.user_id = auth.uid()
    AND pa.role = 'coordinator'
  )
);

-- Patients: read-only
CREATE POLICY "Patient read-only access to pending tasks"
ON pending_tasks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM episodes e
    JOIN patient_access pa ON pa.patient_id = e.patient_id
    WHERE e.id = pending_tasks.episode_id
    AND pa.user_id = auth.uid()
    AND pa.role = 'patient'
  )
);
```

### patient_access

```sql
ALTER TABLE patient_access ENABLE ROW LEVEL SECURITY;

-- Users can see their own access records
CREATE POLICY "Users see own patient access"
ON patient_access FOR SELECT
USING (user_id = auth.uid());

-- Coordinators can grant access to other users for their own patients.
-- The original version of this policy also allowed `user_id = auth.uid()`
-- as an OR clause (self-registration) — that was an unused security hole,
-- removed in 20260616000001_fix_patient_access_rls.sql. There is no
-- self-service insert path anymore; all inserts go through service-role
-- actions (actions/create-patient.ts, actions/join-as-patient.ts).
CREATE POLICY "Coordinators can insert patient access for own patients"
ON patient_access FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM patient_access existing
    WHERE existing.patient_id = patient_access.patient_id
    AND existing.user_id = auth.uid()
    AND existing.role = 'coordinator'
  )
);

-- Bilateral revocation (added in
-- 20260702000000_patient_access_provenance_and_revocation.sql). Before this,
-- patient_access had no UPDATE or DELETE policy at all — every mutation went
-- through a service-role action. These three DELETE policies mirror the
-- INSERT policy's EXISTS-subquery shape, giving a DB-enforced boundary
-- instead of relying solely on application code:

-- (a) A patient can revoke ANY coordinator's access to their own record —
--     unconditional, does not require the coordinator's cooperation.
CREATE POLICY "Patients can revoke coordinator access to their own record"
ON patient_access FOR DELETE
USING (
  role = 'coordinator'
  AND EXISTS (
    SELECT 1 FROM patient_access self
    WHERE self.patient_id = patient_access.patient_id
      AND self.user_id = auth.uid() AND self.role = 'patient'
  )
);

-- (b) A coordinator can revoke their OWN access (self-revoke / "leave").
CREATE POLICY "Coordinators can revoke their own access"
ON patient_access FOR DELETE
USING (user_id = auth.uid() AND role = 'coordinator');

-- (c) A coordinator can revoke a patient-role row for a patient they coordinate.
CREATE POLICY "Coordinators can revoke patient-role access for own patients"
ON patient_access FOR DELETE
USING (
  role = 'patient'
  AND EXISTS (
    SELECT 1 FROM patient_access existing
    WHERE existing.patient_id = patient_access.patient_id
      AND existing.user_id = auth.uid() AND existing.role = 'coordinator'
  )
);

-- Visibility: a patient must be able to see who has coordinator access to
-- their own record (the previous SELECT policy above only returns the
-- caller's own row) — this is what powers the patient-visible "who has
-- access" list at /dashboard/[patientId]/access.
CREATE POLICY "Patients can see coordinator access rows for their own record"
ON patient_access FOR SELECT
USING (
  role = 'coordinator'
  AND EXISTS (
    SELECT 1 FROM patient_access self
    WHERE self.patient_id = patient_access.patient_id
      AND self.user_id = auth.uid() AND self.role = 'patient'
  )
);
```

### patient_invites

```sql
ALTER TABLE patient_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coordinators can insert invites for their patients"
ON patient_invites FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM patient_access
    WHERE patient_access.patient_id = patient_invites.patient_id
      AND patient_access.user_id = auth.uid()
      AND patient_access.role = 'coordinator'
  )
);

CREATE POLICY "coordinators can view their own invites"
ON patient_invites FOR SELECT
USING (created_by = auth.uid());
```

Invite lookup during redemption (`getInviteByToken` in `lib/dal/invites.ts`) happens pre-authentication, so it uses `createServiceClient()` rather than relying on either policy above.

### profiles

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Baseline: a user can read/update only their own profile.
CREATE POLICY "Users can read and update their own profile"
ON profiles FOR ALL
USING (id = auth.uid());

-- Added in 20260702000000_patient_access_provenance_and_revocation.sql — the
-- "who has access" list needs to render a coordinator's NAME, and the
-- baseline policy above only ever lets you see your own.
CREATE POLICY "Users can see the name of anyone who shares patient access with them"
ON profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM patient_access mine
    JOIN patient_access theirs ON theirs.patient_id = mine.patient_id
    WHERE mine.user_id = auth.uid() AND theirs.user_id = profiles.id
  )
);
```

---

## V2 Schema Additions (not built yet — documented for awareness)

When V2 ships, the following additions are planned:

1. **EpisodeSummaryHistory archive**
   ~~Automatic DocumentAction → PendingTask promotion~~ — this now happens in V1 as
   part of the translate step. Every DocumentAction is immediately promoted to a
   PendingTask at write time via `lib/ai/classify-action.ts`.
   V2 addition: archive table storing previous EpisodeSummary versions before
   regeneration. Enables "what did this say on Day 3" queries.

2. **EpisodeSummaryHistory**
   Archive table storing previous versions of EpisodeSummary before regeneration. Enables "what did this say on Day 3" queries.

3. **Multi-currency support**
   `currency_code` field on Episode. Requires data migration for existing records.
