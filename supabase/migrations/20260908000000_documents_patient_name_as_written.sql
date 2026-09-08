-- OrganizeSchema.patient_name_as_written (lib/validation/schemas.ts) has been
-- extracted by the AI on every organize run since D-012 but was never
-- persisted anywhere — organize.ts's documents update omitted it, so the
-- value was silently discarded every time. Found while building the document
-- detail page (which assumed the column already existed).
alter table documents
  add column patient_name_as_written text; -- verbatim-or-null, Rule-4 clinical-noun exemption
