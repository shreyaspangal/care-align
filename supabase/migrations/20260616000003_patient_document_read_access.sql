-- Allow patients to read documents for their own patient record.
--
-- The initial schema intentionally omitted a patient SELECT policy on documents
-- (comment: "patient does not see raw documents"). However the patient view page
-- calls getEpisodeDocuments() via the regular RLS-enforced client, which returns
-- 0 rows for a patient user — showing a false empty state even when documents exist.
--
-- Patients need read access to document metadata (name, type, date, status) to
-- render the document list. The translation content is gated separately via the
-- existing "Patient read-only access to translations" policy on document_translations.

CREATE POLICY "Patient read-only access to documents"
ON public.documents FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.episodes e
    JOIN public.patient_access pa ON pa.patient_id = e.patient_id
    WHERE e.id = documents.episode_id
      AND pa.user_id = auth.uid()
      AND pa.role = 'patient'
  )
);
