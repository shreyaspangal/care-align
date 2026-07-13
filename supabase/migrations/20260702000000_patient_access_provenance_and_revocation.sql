-- Unified access model foundation: provenance tracking + bilateral revocation.
-- See docs/PRIVACY_TRUST_RESEARCH.md for the mitigations this implements
-- (bilateral revocation, distinguishable grant provenance, visible
-- "who has access" list) and docs/ONBOARDING_RESEARCH.md for the product
-- direction (one shell, per-record permissions instead of two separate apps).

-- ── 1. Provenance ────────────────────────────────────────────────────────────

CREATE TYPE public.patient_access_provenance AS ENUM ('self_consented', 'coordinator_attested');
-- self_consented:       the access-holder performed the granting action themselves
--                       (redeemed a patient_invites token). Today only ever
--                       applies to role = 'patient' rows, via redeemToken().
-- coordinator_attested: a coordinator created this row asserting authority to
--                       act on the patient's behalf, without the record-
--                       subject's direct action at grant time. Today only ever
--                       applies to the bootstrap row in createPatient(). Never
--                       collapse the two — the CareZone anti-pattern was
--                       treating both cases identically with no distinction.

ALTER TABLE public.patient_access
  ADD COLUMN provenance patient_access_provenance,
  ADD COLUMN invite_id  UUID REFERENCES public.patient_invites(id) ON DELETE SET NULL;

-- Backfill: the only two insert paths that have ever existed map 1:1 to role.
UPDATE public.patient_access SET provenance = 'coordinator_attested' WHERE role = 'coordinator';
UPDATE public.patient_access SET provenance = 'self_consented'       WHERE role = 'patient';

ALTER TABLE public.patient_access ALTER COLUMN provenance SET NOT NULL;

CREATE INDEX idx_patient_access_provenance ON public.patient_access(provenance);
CREATE INDEX idx_patient_access_invite_id  ON public.patient_access(invite_id);

-- ── 2. Bilateral revocation — real RLS DELETE policies ──────────────────────
-- DELETE is already table-granted to `authenticated` via the blanket
-- `GRANT ... ON ALL TABLES IN SCHEMA public` in 20240102000000_fix_grants.sql —
-- only the RLS policy layer was missing (see CLAUDE.md "Two Access Control
-- Layers").

-- (a) A patient can revoke ANY coordinator's access to their own record.
--     Unconditional and bilateral — does not require the coordinator's
--     cooperation. Mirrors DPDP Section 6(4) / MyChart's model.
CREATE POLICY "Patients can revoke coordinator access to their own record"
ON public.patient_access FOR DELETE
USING (
  role = 'coordinator'
  AND EXISTS (
    SELECT 1 FROM public.patient_access self
    WHERE self.patient_id = patient_access.patient_id
      AND self.user_id    = auth.uid()
      AND self.role       = 'patient'
  )
);

-- (b) A coordinator can revoke their OWN access (self-revoke / "leave").
CREATE POLICY "Coordinators can revoke their own access"
ON public.patient_access FOR DELETE
USING (user_id = auth.uid() AND role = 'coordinator');

-- (c) A coordinator can revoke a patient-role row for a patient they coordinate.
--     RLS-layer parity with the existing INSERT policy's shape.
CREATE POLICY "Coordinators can revoke patient-role access for own patients"
ON public.patient_access FOR DELETE
USING (
  role = 'patient'
  AND EXISTS (
    SELECT 1 FROM public.patient_access existing
    WHERE existing.patient_id = patient_access.patient_id
      AND existing.user_id    = auth.uid()
      AND existing.role       = 'coordinator'
  )
);

-- ── 3. Visibility — patient must see coordinator rows for their own record ──
-- Today's only SELECT policy ("Users see own patient access") returns only the
-- caller's own row — a patient cannot see who else has access at all.
CREATE POLICY "Patients can see coordinator access rows for their own record"
ON public.patient_access FOR SELECT
USING (
  role = 'coordinator'
  AND EXISTS (
    SELECT 1 FROM public.patient_access self
    WHERE self.patient_id = patient_access.patient_id
      AND self.user_id    = auth.uid()
      AND self.role       = 'patient'
  )
);

-- ── 4. profiles — needed to render a coordinator's NAME in the "who has
--    access" list. Today's only policy is "id = auth.uid()" FOR ALL — nobody
--    can see anyone else's name, at all.
CREATE POLICY "Users can see the name of anyone who shares patient access with them"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.patient_access mine
    JOIN public.patient_access theirs ON theirs.patient_id = mine.patient_id
    WHERE mine.user_id   = auth.uid()
      AND theirs.user_id = profiles.id
  )
);
