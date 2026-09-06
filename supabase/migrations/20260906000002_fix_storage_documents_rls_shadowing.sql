-- Fixes a column-shadowing bug in the previous migration: the exists()
-- subquery aliases profiles as `p`, which also has a `name` column. The
-- unqualified `name` inside storage.foldername(name) resolved to the
-- innermost scope (profiles.name — a person's name, e.g. "Test Member"),
-- not the outer storage.objects.name (the file path). foldername() on a
-- plain name string returns an empty array, so the check was always false —
-- every upload was silently denied regardless of correct family/profile data.
--
-- Fix: schema-qualify as storage.objects.name so it can't be shadowed.

drop policy documents_bucket_family_insert on storage.objects;
drop policy documents_bucket_family_select on storage.objects;

create policy documents_bucket_family_insert on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and exists (
      select 1 from profiles p
      where p.id = ((storage.foldername(storage.objects.name))[1])::uuid
        and p.family_id = (select current_family_id())
    )
  );

create policy documents_bucket_family_select on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from profiles p
      where p.id = ((storage.foldername(storage.objects.name))[1])::uuid
        and p.family_id = (select current_family_id())
    )
  );
