-- ============================================================================
-- VEY RASHA — Initial PostgreSQL Schema for Supabase
-- Single-boutique luxury women's fashion storefront (1 owner, many customers)
-- Zero fake customers, zero fake orders, zero fabricated boutique inventory.
-- ============================================================================

create extension if not exists "pgcrypto";

-- Role & Status Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'boutique_role') then
    create type public.boutique_role as enum ('customer', 'owner');
  end if;

  if not exists (select 1 from pg_type where typname = 'order_status_enum') then
    create type public.order_status_enum as enum (
      'PENDING_REVIEW',
      'CONFIRMED',
      'PROCESSING',
      'READY_FOR_DISPATCH',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_status_enum') then
    create type public.payment_status_enum as enum (
      'UNPAID',
      'PAYMENT_PENDING',
      'PAID',
      'REFUNDED'
    );
  end if;
end $$;

-- Shared updated_at trigger function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1. profiles
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text not null default '',
  avatar_url text,
  tier_label text not null default 'Client',
  preferred_size text not null default 'M',
  newsletter_opt_in boolean not null default false,
  sms_updates_opt_in boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. user_roles (Strict RBAC: only DB-assigned 'owner' has owner authority)
-- ----------------------------------------------------------------------------
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.boutique_role not null default 'customer',
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, role)
);

create index if not exists idx_user_roles_user_id on public.user_roles (user_id);
create index if not exists idx_user_roles_role on public.user_roles (role);

-- Auto-create profile + default customer role when a user signs in with Google
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_avatar text;
begin
  v_full_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    ''
  );
  v_avatar := coalesce(
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'picture',
    null
  );

  insert into public.profiles (id, full_name, email, avatar_url)
  values (new.id, v_full_name, coalesce(new.email, ''), v_avatar)
  on conflict (id) do update
    set email = coalesce(nullif(excluded.email, ''), public.profiles.email),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        full_name = case
          when public.profiles.full_name = '' then excluded.full_name
          else public.profiles.full_name
        end;

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. categories
-- ----------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  description text not null default '',
  image_path text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. products
-- ----------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category_id uuid references public.categories(id) on delete set null,
  category_slug text not null,
  category_label text not null,
  collection_id text not null default '',
  name text not null,
  subtitle text not null default '',
  description text not null default '',
  material text not null default '',
  care text not null default '',
  price_usd numeric(12, 2) not null check (price_usd >= 0),
  currency_code text not null default 'USD',
  is_new_arrival boolean not null default false,
  is_best_seller boolean not null default false,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_products_published_category
  on public.products (is_published, category_slug, sort_order);

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. product_images
-- ----------------------------------------------------------------------------
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  alt_text text not null default '',
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_product_images_product_id
  on public.product_images (product_id, sort_order);

-- ----------------------------------------------------------------------------
-- 6. product_variants (Authoritative sizes, colours & inventory counts)
-- ----------------------------------------------------------------------------
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null,
  color_name text not null,
  color_hex text not null default '#D8C3A5',
  sku text,
  price_override_usd numeric(12, 2) check (price_override_usd is null or price_override_usd >= 0),
  stock_count integer not null default 0 check (stock_count >= 0),
  is_available boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (product_id, size, color_name)
);

create index if not exists idx_product_variants_product_id
  on public.product_variants (product_id);

drop trigger if exists trg_product_variants_updated_at on public.product_variants;
create trigger trg_product_variants_updated_at
  before update on public.product_variants
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 7. wishlists & 8. wishlist_items
-- ----------------------------------------------------------------------------
create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists trg_wishlists_updated_at on public.wishlists;
create trigger trg_wishlists_updated_at
  before update on public.wishlists
  for each row execute function public.set_updated_at();

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (wishlist_id, product_id)
);

create index if not exists idx_wishlist_items_user_id on public.wishlist_items (user_id);

-- ----------------------------------------------------------------------------
-- 9. carts & 10. cart_items
-- ----------------------------------------------------------------------------
create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  gift_presentation boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists trg_carts_updated_at on public.carts;
create trigger trg_carts_updated_at
  before update on public.carts
  for each row execute function public.set_updated_at();

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  selected_size text not null,
  selected_color_name text not null,
  selected_color_hex text not null default '#D8C3A5',
  quantity integer not null default 1 check (quantity > 0 and quantity <= 20),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (cart_id, product_id, selected_size, selected_color_name)
);

create index if not exists idx_cart_items_user_id on public.cart_items (user_id);

drop trigger if exists trg_cart_items_updated_at on public.cart_items;
create trigger trg_cart_items_updated_at
  before update on public.cart_items
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 11. addresses (Manual customer entry only — never device GPS)
-- ----------------------------------------------------------------------------
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  recipient_name text not null,
  phone text not null default '',
  country text not null,
  city text not null,
  area text not null,
  delivery_address text not null,
  delivery_instructions text,
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_addresses_user_id on public.addresses (user_id);

drop trigger if exists trg_addresses_updated_at on public.addresses;
create trigger trg_addresses_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 12. orders & 13. order_items (Server-created with immutable item snapshots)
-- ----------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_reference text not null unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  order_status public.order_status_enum not null default 'PENDING_REVIEW',
  payment_status public.payment_status_enum not null default 'UNPAID',
  customer_full_name text not null,
  customer_phone text not null,
  customer_country text not null,
  customer_city text not null,
  customer_area text not null,
  customer_delivery_address text not null,
  customer_delivery_instructions text,
  currency_at_order text not null default 'USD',
  gift_presentation boolean not null default false,
  subtotal_usd numeric(12, 2) not null check (subtotal_usd >= 0),
  delivery_fee_usd numeric(12, 2) check (delivery_fee_usd is null or delivery_fee_usd >= 0),
  final_total_usd numeric(12, 2) check (final_total_usd is null or final_total_usd >= 0),
  estimated_delivery_time text,
  owner_message text,
  confirmed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_orders_user_created
  on public.orders (user_id, created_at desc);
create index if not exists idx_orders_status_created
  on public.orders (order_status, created_at desc);

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name_snapshot text not null,
  subtitle_snapshot text,
  size_snapshot text not null,
  color_name_snapshot text not null,
  color_hex_snapshot text,
  image_url_snapshot text not null default '',
  quantity integer not null check (quantity > 0),
  unit_price_usd numeric(12, 2) not null check (unit_price_usd >= 0),
  line_total_usd numeric(12, 2) not null check (line_total_usd >= 0),
  currency_code text not null default 'USD',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_order_items_order_id on public.order_items (order_id);
create index if not exists idx_order_items_user_id on public.order_items (user_id);

-- ----------------------------------------------------------------------------
-- 14. notifications (Private customer updates + owner new-order alerts)
-- ----------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  target_role public.boutique_role not null default 'customer',
  order_id uuid references public.orders(id) on delete cascade,
  order_reference text,
  type text not null check (type in ('order_update', 'delivery_update', 'boutique_announcement')),
  type_label text not null,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  action_route text,
  confirmed_delivery_fee_usd numeric(12, 2),
  confirmed_final_total_usd numeric(12, 2),
  estimated_delivery_time text,
  currency_code text default 'USD',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);
create index if not exists idx_notifications_role_created
  on public.notifications (target_role, created_at desc);

-- ----------------------------------------------------------------------------
-- 15. store_settings (Single-boutique public storefront configuration)
-- ----------------------------------------------------------------------------
create table if not exists public.store_settings (
  id integer primary key default 1 check (id = 1),
  boutique_name text not null default 'VEY RASHA',
  default_currency text not null default 'USD',
  supported_currencies text[] not null default array['USD', 'EUR', 'GBP', 'CAD', 'AED', 'NGN'],
  gift_presentation_available boolean not null default true,
  gift_presentation_label text not null default 'Signature atelier gift box & ribbon',
  pickup_location_note text not null default 'Pickup details are shared once your order is confirmed.',
  hero_image_path text,
  collections jsonb not null default '[]'::jsonb,
  campaigns jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists trg_store_settings_updated_at on public.store_settings;
create trigger trg_store_settings_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

-- Ensure baseline non-sensitive store configuration row exists without fake products/orders
insert into public.store_settings (id, boutique_name)
values (1, 'VEY RASHA')
on conflict (id) do nothing;
