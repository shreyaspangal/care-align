-- storage.objects had INSERT and SELECT policies for the `documents` bucket
-- but no UPDATE or DELETE policy -- Postgres RLS default-deny meant nobody,
-- including the owning family, could delete an uploaded file. Found by the
-- storage.objects RLS proof test (__tests__/rls/storage-objects-rls-proof.test.ts).
--
-- Rule 3 ("Capture is sacred... Only the user deletes") explicitly permits
-- user-initiated deletion, so this closes that gap with the same
-- family-ownership predicate as the existing SELECT/INSERT policies.
--
-- UPDATE (in-place overwrite of a file's bytes) is deliberately NOT granted
-- here: a document's extracted fields (title, dates, terms) are tied to the
-- specific bytes that were organized. Silently swapping those bytes via
-- upsert would leave the record describing a file that no longer exists,
-- which is worse than the current gap. Replacing a capture is "delete, then
-- re-upload as a new document" -- a new document_id, a fresh organize run.

create policy documents_bucket_family_delete on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from profiles p
      where p.id = ((storage.foldername(storage.objects.name))[1])::uuid
        and p.family_id = (select current_family_id())
    )
  );
