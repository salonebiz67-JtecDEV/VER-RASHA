-- ============================================================================
-- VEY RASHA — Supabase Storage Buckets & Access Policies
-- Bucket: `boutique-media` (product, collection & editorial imagery)
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'boutique-media',
  'boutique-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public read access for published boutique media assets
drop policy if exists "Public read boutique-media" on storage.objects;
create policy "Public read boutique-media"
  on storage.objects for select
  to public
  using (bucket_id = 'boutique-media');

-- Owner-only upload/update/delete for boutique media
drop policy if exists "Owner uploads boutique-media" on storage.objects;
create policy "Owner uploads boutique-media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'boutique-media' and public.is_boutique_owner());

drop policy if exists "Owner updates boutique-media" on storage.objects;
create policy "Owner updates boutique-media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'boutique-media' and public.is_boutique_owner())
  with check (bucket_id = 'boutique-media' and public.is_boutique_owner());

drop policy if exists "Owner deletes boutique-media" on storage.objects;
create policy "Owner deletes boutique-media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'boutique-media' and public.is_boutique_owner());
