-- =============================================================================
-- Patient Coordinator — Initial Schema
-- Applies the full data model from docs/DATA_MODEL.md.
-- Order: enums → helper fn → tables (dependency order) → indexes → RLS → RPC
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enum types
-- -----------------------------------------------------------------------------

CREATE TYPE user_role AS ENUM ('coordinator', 'patient');

CREATE TYPE admission_status AS ENUM ('admitted', 'outpatient');

CREATE TYPE episode_status AS ENUM ('active', 'care_complete', 'closed');

CREATE TYPE document_type AS ENUM (
  'prescription',
  'lab_report',
  'discharge_summary',
  'bill',
  'observation_note',
  'other'
);

CREATE TYPE document_status AS ENUM (
  'pending_classification',
  'classified',
  'translated',
  'failed'
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
-- V1: en only. Other values reserved for V3 Sarvam AI integration.

-- -----------------------------------------------------------------------------
-- 2. Helper function used in RLS policies
--    SECURITY DEFINER so it can query patient_access without bypassing RLS
--    elsewhere — it only reads what is needed to verify access.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION user_has_patient_access(p_patient_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM patient_access
    WHERE patient_access.patient_id = p_patient_id
      AND patient_access.user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 3. Tables (dependency order)
-- -----------------------------------------------------------------------------

-- profiles: one-to-one with auth.users. Application-level extension of auth.
-- PK mirrors auth.users.id — no separate UUID generation.
CREATE TABLE profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  role                user_role NOT NULL,
  preferred_language  preferred_language NOT NULL DEFAULT 'en',
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_role ON profiles(role);

-- patients: the person receiving care. Center of everything.
-- No Aadhaar/PAN — DPDP compliance by design.
CREATE TABLE patients (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  date_of_birth           DATE NOT NULL,
  gender                  TEXT NOT NULL,
  blood_group             TEXT,
  insurance_provider_name TEXT,
  admission_status        admission_status NOT NULL DEFAULT 'admitted',
  deleted_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- patient_access: links users (profiles) to patients with a role.
-- Supports multiple coordinators per patient and the patient themselves.
-- UNIQUE(user_id, patient_id) prevents duplicate access grants.
CREATE TABLE patient_access (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id),
  patient_id  UUID NOT NULL REFERENCES patients(id),
  role        user_role NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, patient_id)
);

CREATE INDEX idx_patient_access_user_id    ON patient_access(user_id);
CREATE INDEX idx_patient_access_patient_id ON patient_access(patient_id);

-- episodes: one hospitalisation = one episode.
-- Two end dates because medical clearance and admin resolution are distinct events.
CREATE TABLE episodes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     UUID NOT NULL REFERENCES patients(id),
  started_at     DATE NOT NULL,
  care_ended_at  DATE,
  admin_ended_at DATE,
  status         episode_status NOT NULL DEFAULT 'active',
  total_cost     DECIMAL(12,2) DEFAULT 0,
  -- INR assumed. V1 is India-only.
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_episodes_patient_id       ON episodes(patient_id);
CREATE INDEX idx_episodes_status           ON episodes(status);
CREATE INDEX idx_episodes_patient_status   ON episodes(patient_id, status);

-- documents: every uploaded slip, report, prescription, or bill.
-- type defaults to 'other' — updated by Claude after classification.
-- document_date is nullable — Claude returns null when absent/illegible.
-- file_key stores Vercel Blob pathname only, never the full URL.
CREATE TABLE documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id        UUID NOT NULL REFERENCES episodes(id),
  name              TEXT NOT NULL,
  type              document_type NOT NULL DEFAULT 'other',
  purpose           TEXT,
  source_hospital   TEXT,
  source_department TEXT,
  document_date     DATE,
  file_key          TEXT NOT NULL,
  status            document_status NOT NULL DEFAULT 'pending_classification',
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_episode_id    ON documents(episode_id);
CREATE INDEX idx_documents_type          ON documents(type);
CREATE INDEX idx_documents_status        ON documents(status);
CREATE INDEX idx_documents_episode_type  ON documents(episode_id, type);
CREATE INDEX idx_documents_document_date ON documents(document_date);

-- document_translations: Claude's plain-language output. One-to-one with documents.
-- UNIQUE on document_id enforces the one-to-one relationship at DB level.
-- prompt_version records which prompt produced this translation (for selective re-translation).
CREATE TABLE document_translations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    UUID NOT NULL UNIQUE REFERENCES documents(id),
  plain_language TEXT NOT NULL,
  what_it_means  TEXT NOT NULL,
  prompt_version TEXT NOT NULL DEFAULT 'v1',
  deleted_at     TIMESTAMPTZ,
  translated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_translations_document_id ON document_translations(document_id);

-- document_actions: individual actions extracted from a translation.
-- One translation → zero or more actions. Empty is valid (silence is valid).
CREATE TABLE document_actions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  translation_id UUID NOT NULL REFERENCES document_translations(id),
  action_for     action_for NOT NULL,
  description    TEXT NOT NULL,
  status         action_status NOT NULL DEFAULT 'open',
  resolved_at    TIMESTAMPTZ,
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_actions_translation_id     ON document_actions(translation_id);
CREATE INDEX idx_document_actions_status             ON document_actions(status);
CREATE INDEX idx_document_actions_translation_status ON document_actions(translation_id, status);

-- episode_summaries: Claude's living synthesis of the episode. One-to-one with episodes.
-- version increments on every regeneration — never resets to 1 after creation.
-- Use the upsert_episode_summary RPC (defined below) — never a plain .upsert().
CREATE TABLE episode_summaries (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id         UUID NOT NULL UNIQUE REFERENCES episodes(id),
  visit_purpose      TEXT NOT NULL,
  timeline_summary   TEXT NOT NULL,
  status_label       TEXT NOT NULL,
  status_description TEXT NOT NULL,
  version            INTEGER NOT NULL DEFAULT 1,
  deleted_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_episode_summaries_episode_id ON episode_summaries(episode_id);

-- pending_tasks: coordinator-level tasks. Phase-aware — only surface at right time.
-- source_action_id is nullable: null = manually created, non-null = promoted from DocumentAction (V2+).
CREATE TABLE pending_tasks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id       UUID NOT NULL REFERENCES episodes(id),
  source_action_id UUID REFERENCES document_actions(id),
  category         task_category NOT NULL,
  description      TEXT NOT NULL,
  phase_appears    task_phase NOT NULL,
  status           task_status NOT NULL DEFAULT 'open',
  resolution_note  TEXT,
  resolved_at      TIMESTAMPTZ,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pending_tasks_episode_id          ON pending_tasks(episode_id);
CREATE INDEX idx_pending_tasks_source_action_id    ON pending_tasks(source_action_id);
CREATE INDEX idx_pending_tasks_status              ON pending_tasks(status);
CREATE INDEX idx_pending_tasks_phase               ON pending_tasks(phase_appears);
CREATE INDEX idx_pending_tasks_episode_status      ON pending_tasks(episode_id, status);
CREATE INDEX idx_pending_tasks_episode_phase_status ON pending_tasks(episode_id, phase_appears, status);

-- -----------------------------------------------------------------------------
-- 4. Auth trigger — auto-create profile on signup
--    SECURITY DEFINER so it can write to profiles from the auth context.
--    name + role come from raw_user_meta_data passed during signUp().
-- -----------------------------------------------------------------------------

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

-- -----------------------------------------------------------------------------
-- 5. Row Level Security
--    Every table has RLS enabled. Two tiers: coordinator (full access) and
--    patient (read-only on translations, summaries, tasks only).
-- -----------------------------------------------------------------------------

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read and update their own profile"
ON profiles FOR ALL
USING (id = auth.uid());

-- patients
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

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

-- patient_access
ALTER TABLE patient_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own patient access"
ON patient_access FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Coordinators can insert patient access for own patients"
ON patient_access FOR INSERT
WITH CHECK (
  -- Either the user is already a coordinator for this patient (granting others)
  EXISTS (
    SELECT 1 FROM patient_access existing
    WHERE existing.patient_id = patient_access.patient_id
      AND existing.user_id = auth.uid()
      AND existing.role = 'coordinator'
  )
  OR
  -- Or the user is inserting their own first access row (self-registration)
  user_id = auth.uid()
);

-- episodes
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access episodes for own patients"
ON episodes FOR ALL
USING (user_has_patient_access(patient_id));

-- documents — coordinator only (patient does not see raw documents)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

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

-- document_translations — coordinator full, patient read-only
ALTER TABLE document_translations ENABLE ROW LEVEL SECURITY;

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

-- document_actions — coordinator only
ALTER TABLE document_actions ENABLE ROW LEVEL SECURITY;

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

-- episode_summaries — coordinator full, patient read-only
ALTER TABLE episode_summaries ENABLE ROW LEVEL SECURITY;

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

-- pending_tasks — coordinator full, patient read-only
ALTER TABLE pending_tasks ENABLE ROW LEVEL SECURITY;

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

-- -----------------------------------------------------------------------------
-- 6. upsert_episode_summary RPC
--    Encapsulates the INSERT...ON CONFLICT with version increment.
--    Called from lib/db/episode-summaries.ts — never use a plain .upsert()
--    because the Supabase JS client would reset version to whatever is passed in.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION upsert_episode_summary(
  p_episode_id        UUID,
  p_visit_purpose     TEXT,
  p_timeline_summary  TEXT,
  p_status_label      TEXT,
  p_status_description TEXT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO episode_summaries
    (episode_id, visit_purpose, timeline_summary, status_label, status_description, version, created_at, updated_at)
  VALUES
    (p_episode_id, p_visit_purpose, p_timeline_summary, p_status_label, p_status_description, 1, now(), now())
  ON CONFLICT (episode_id) DO UPDATE SET
    visit_purpose      = EXCLUDED.visit_purpose,
    timeline_summary   = EXCLUDED.timeline_summary,
    status_label       = EXCLUDED.status_label,
    status_description = EXCLUDED.status_description,
    version            = episode_summaries.version + 1,
    updated_at         = now();
    -- created_at is intentionally excluded — it must never change after first insert.
END;
$$ LANGUAGE plpgsql;
