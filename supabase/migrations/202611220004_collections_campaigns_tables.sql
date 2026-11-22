-- ============================================================================
-- VEY RASHA — Normalized Collections & Campaigns Tables + RLS Policies
-- Moves collections & editorial campaigns to first-class PostgreSQL tables
-- with schedule dates, status constraints, and owner-only write protection.
-- ============================================================================

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null check (char_length(trim(title)) > 0),
  season text not null default '',
  summary text not null default '',
  image_path text,
  filter_category text not null default 'all',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_collections_active_order
  on public.collections (is_active, sort_order, created_at desc);

drop trigger if exists trg_collections_updated_at on public.collections;
create trigger trg_collections_updated_at
  before update on public.collections
  for each row execute function public.set_updated_at();

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  kicker text not null default '',
  title text not null check (char_length(trim(title)) > 0),
  description text not null default '',
  cta_label text not null default 'Shop Collection',
  image_path text,
  target_category text not null default 'all',
  status text not null default 'draft' check (status in ('draft', 'active', 'scheduled', 'archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint chk_campaigns_date_range check (
    starts_at is null or ends_at is null or ends_at > starts_at
  )
);

create index if not exists idx_campaigns_status_order
  on public.campaigns (status, sort_order, created_at desc);

drop trigger if exists trg_campaigns_updated_at on public.campaigns;
create trigger trg_campaigns_updated_at
  before update on public.campaigns
  for each row execute function public.set_updated_at();

alter table public.collections enable row level security;
alter table public.campaigns enable row level security;

-- Public storefront can read active collections; owner can read all
drop policy if exists "Public read active collections" on public.collections;
create policy "Public read active collections"
  on public.collections for select
  to anon, authenticated
  using (is_active = true or public.is_boutique_owner());

drop policy if exists "Owner manages collections" on public.collections;
create policy "Owner manages collections"
  on public.collections for all
  to authenticated
  using (public.is_boutique_owner())
  with check (public.is_boutique_owner());

-- Public storefront can read currently active campaigns within schedule window; owner reads all
drop policy if exists "Public read active campaigns" on public.campaigns;
create policy "Public read active campaigns"
  on public.campaigns for select
  to anon, authenticated
  using (
    (
      status = 'active'
      and (starts_at is null or starts_at <= timezone('utc', now()))
      and (ends_at is null or ends_at >= timezone('utc', now()))
    )
    or public.is_boutique_owner()
  );

drop policy if exists "Owner manages campaigns" on public.campaigns;
create policy "Owner manages campaigns"
  on public.campaigns for all
  to authenticated
  using (public.is_boutique_owner())
  with check (public.is_boutique_owner());
