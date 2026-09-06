-- The 'documents' storage bucket was created out-of-band (dashboard/CLI, not
-- a migration — D-003 gap) and shipped with zero RLS policies on
-- storage.objects for it. Storage enforces RLS by default, so every upload
-- was silently blocked (createSignedUploadUrl itself checks INSERT, since the
-- signed-URL row is reserved at creation time, not just at PUT time).
--
-- Same two-layer pattern as every other table (Hard Rule 5): base grants on
-- storage.objects are pre-provisioned by Supabase's storage extension, so
-- only the RLS policy layer is ours to add here. Path convention (set in
-- app/api/uploads/sign/route.ts) is `${profileId}/${randomUUID()}` — the
-- first path segment is the profile id, checked against the caller's family
-- via the existing profiles table rather than duplicating current_family_id()
-- logic against a foldername string.
--
-- NOTE: this version has a column-shadowing bug (unqualified `name` resolves
-- to profiles.name, not storage.objects.name) — fixed in the next migration.
-- Left as-applied for migration-history accuracy; do not edit.

create policy documents_bucket_family_insert on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and exists (
      select 1 from profiles p
      where p.id = ((storage.foldername(name))[1])::uuid
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
      where p.id = ((storage.foldername(name))[1])::uuid
        and p.family_id = (select current_family_id())
    )
  );
