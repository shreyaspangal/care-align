-- Remove the self-registration loophole from patient_access INSERT policy.
--
-- The original OR user_id = auth.uid() clause was written for "self-registration"
-- but every patient_access insert in the codebase uses createServiceClient()
-- (service role, bypasses RLS). The clause is unused and dangerous: with anonymous
-- auth enabled, any authenticated user can self-grant patient-role access to any
-- patient UUID they know (e.g. from a URL they previously visited).
--
-- After this migration, patient_access inserts require either:
--   a) Being a coordinator for that patient (regular client)
--   b) Service role — used by redeemToken() and create-patient.ts (bypasses RLS)

DROP POLICY "Coordinators can insert patient access for own patients" ON public.patient_access;

CREATE POLICY "Coordinators can insert patient access for own patients"
ON public.patient_access FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.patient_access existing
    WHERE existing.patient_id = patient_access.patient_id
      AND existing.user_id    = auth.uid()
      AND existing.role       = 'coordinator'
  )
);
