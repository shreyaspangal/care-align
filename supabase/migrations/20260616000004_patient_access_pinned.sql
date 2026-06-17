-- Allow coordinators to pin patients so they always appear at the top of their sidebar.
-- pinned_at is set to now() when pinned, null when unpinned.
-- Ordering: pinned first (nulls last), then by most recent activity.

ALTER TABLE public.patient_access
  ADD COLUMN pinned_at TIMESTAMPTZ DEFAULT NULL;

GRANT UPDATE (pinned_at) ON public.patient_access TO authenticated;
