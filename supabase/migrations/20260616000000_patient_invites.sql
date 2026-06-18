-- Patient invite tokens — coordinator generates a link, patient redeems it to get access.
-- One token per row. Expires after 7 days. Single-use (used_at set on redemption).

CREATE TABLE public.patient_invites (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token      TEXT        UNIQUE NOT NULL DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  patient_id UUID        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  created_by UUID        NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  used_at    TIMESTAMPTZ,
  used_by    UUID        REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.patient_invites ENABLE ROW LEVEL SECURITY;

-- Coordinators can create invites for patients they manage
CREATE POLICY "coordinators can insert invites for their patients"
  ON public.patient_invites FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.patient_access
      WHERE user_id  = auth.uid()
        AND patient_id = patient_invites.patient_id
        AND role = 'coordinator'
    )
  );

-- Coordinators can view invites they created
CREATE POLICY "coordinators can view their own invites"
  ON public.patient_invites FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- Required alongside RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_invites TO authenticated;
GRANT ALL ON public.patient_invites TO service_role;
