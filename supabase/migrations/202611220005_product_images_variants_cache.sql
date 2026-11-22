-- ============================================================================
-- VEY RASHA — Additive Image Variants, Deduplication & Cache Versioning Migration
-- Safely extends product_images and media-bearing catalog tables without altering
-- or deleting existing records.
-- ============================================================================

alter table public.product_images
  add column if not exists card_storage_path text,
  add column if not exists detail_storage_path text,
  add column if not exists content_hash text,
  add column if not exists image_version integer not null default 1 check (image_version >= 1),
  add column if not exists mime_type text,
  add column if not exists width integer check (width is null or width > 0),
  add column if not exists height integer check (height is null or height > 0),
  add column if not exists size_bytes integer check (size_bytes is null or size_bytes >= 0),
  add column if not exists card_size_bytes integer check (card_size_bytes is null or card_size_bytes >= 0),
  add column if not exists detail_size_bytes integer check (detail_size_bytes is null or detail_size_bytes >= 0);

create index if not exists idx_product_images_content_hash
  on public.product_images (content_hash)
  where content_hash is not null;

alter table public.categories
  add column if not exists image_version integer not null default 1 check (image_version >= 1);

alter table public.collections
  add column if not exists image_version integer not null default 1 check (image_version >= 1);

alter table public.campaigns
  add column if not exists image_version integer not null default 1 check (image_version >= 1);

alter table public.store_settings
  add column if not exists hero_image_version integer not null default 1 check (hero_image_version >= 1);
