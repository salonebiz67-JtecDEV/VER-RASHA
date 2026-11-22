-- ============================================================================
-- VEY RASHA — Row Level Security (RLS), Role Guards & Realtime Publication
-- ============================================================================

-- Helper: returns true ONLY when the authenticated user has the DB-verified 'owner' role
create or replace function public.is_boutique_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'owner'
  );
$$;

revoke all on function public.is_boutique_owner() from public;
grant execute on function public.is_boutique_owner() to authenticated, anon;

-- Protect sensitive profile fields (tier_label, email identity mismatch) from client tampering
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
as $$
begin
  if not public.is_boutique_owner() then
    new.id := old.id;
    new.tier_label := old.tier_label;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_update on public.profiles;
create trigger trg_guard_profile_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Protect notification immutable fields so customers can only toggle is_read
create or replace function public.guard_notification_update()
returns trigger
language plpgsql
as $$
begin
  if not public.is_boutique_owner() then
    new.id := old.id;
    new.user_id := old.user_id;
    new.target_role := old.target_role;
    new.order_id := old.order_id;
    new.order_reference := old.order_reference;
    new.type := old.type;
    new.type_label := old.type_label;
    new.title := old.title;
    new.message := old.message;
    new.action_route := old.action_route;
    new.confirmed_delivery_fee_usd := old.confirmed_delivery_fee_usd;
    new.confirmed_final_total_usd := old.confirmed_final_total_usd;
    new.estimated_delivery_time := old.estimated_delivery_time;
    new.currency_code := old.currency_code;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_notification_update on public.notifications;
create trigger trg_guard_notification_update
  before update on public.notifications
  for each row execute function public.guard_notification_update();

-- ----------------------------------------------------------------------------
-- Enable RLS on ALL 15 tables
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.notifications enable row level security;
alter table public.store_settings enable row level security;

-- ----------------------------------------------------------------------------
-- 1. profiles
-- ----------------------------------------------------------------------------
drop policy if exists "Customers read own profile" on public.profiles;
create policy "Customers read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id or public.is_boutique_owner());

drop policy if exists "Customers update own profile" on public.profiles;
create policy "Customers update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Customers insert own profile" on public.profiles;
create policy "Customers insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- 2. user_roles (Read own role only; NEVER writable by customers)
-- ----------------------------------------------------------------------------
drop policy if exists "Users read own roles" on public.user_roles;
create policy "Users read own roles"
  on public.user_roles for select
  to authenticated
  using (auth.uid() = user_id or public.is_boutique_owner());

-- ----------------------------------------------------------------------------
-- 3. categories (Public read active; owner full control)
-- ----------------------------------------------------------------------------
drop policy if exists "Public read active categories" on public.categories;
create policy "Public read active categories"
  on public.categories for select
  to anon, authenticated
  using (is_active = true or public.is_boutique_owner());

drop policy if exists "Owner manages categories" on public.categories;
create policy "Owner manages categories"
  on public.categories for all
  to authenticated
  using (public.is_boutique_owner())
  with check (public.is_boutique_owner());

-- ----------------------------------------------------------------------------
-- 4. products, 5. product_images, 6. product_variants
-- ----------------------------------------------------------------------------
drop policy if exists "Public read published products" on public.products;
create policy "Public read published products"
  on public.products for select
  to anon, authenticated
  using (is_published = true or public.is_boutique_owner());

drop policy if exists "Owner manages products" on public.products;
create policy "Owner manages products"
  on public.products for all
  to authenticated
  using (public.is_boutique_owner())
  with check (public.is_boutique_owner());

drop policy if exists "Public read published product images" on public.product_images;
create policy "Public read published product images"
  on public.product_images for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and (p.is_published = true or public.is_boutique_owner())
    )
  );

drop policy if exists "Owner manages product images" on public.product_images;
create policy "Owner manages product images"
  on public.product_images for all
  to authenticated
  using (public.is_boutique_owner())
  with check (public.is_boutique_owner());

drop policy if exists "Public read published product variants" on public.product_variants;
create policy "Public read published product variants"
  on public.product_variants for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and (p.is_published = true or public.is_boutique_owner())
    )
  );

drop policy if exists "Owner manages product variants" on public.product_variants;
create policy "Owner manages product variants"
  on public.product_variants for all
  to authenticated
  using (public.is_boutique_owner())
  with check (public.is_boutique_owner());

-- ----------------------------------------------------------------------------
-- 7. wishlists & 8. wishlist_items (Customer self-only)
-- ----------------------------------------------------------------------------
drop policy if exists "Customer manages own wishlist" on public.wishlists;
create policy "Customer manages own wishlist"
  on public.wishlists for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Customer manages own wishlist items" on public.wishlist_items;
create policy "Customer manages own wishlist items"
  on public.wishlist_items for all
  to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.wishlists w
      where w.id = wishlist_items.wishlist_id and w.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.wishlists w
      where w.id = wishlist_items.wishlist_id and w.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 9. carts & 10. cart_items (Customer self-only)
-- ----------------------------------------------------------------------------
drop policy if exists "Customer manages own cart" on public.carts;
create policy "Customer manages own cart"
  on public.carts for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Customer manages own cart items" on public.cart_items;
create policy "Customer manages own cart items"
  on public.cart_items for all
  to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 11. addresses (Customer self-only)
-- ----------------------------------------------------------------------------
drop policy if exists "Customer manages own addresses" on public.addresses;
create policy "Customer manages own addresses"
  on public.addresses for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 12. orders & 13. order_items
-- Customers may READ their own orders only. Orders are created & priced
-- server-side in the `create-order` Edge Function, and updated only by owner.
-- ----------------------------------------------------------------------------
drop policy if exists "Customer reads own orders; owner reads all" on public.orders;
create policy "Customer reads own orders; owner reads all"
  on public.orders for select
  to authenticated
  using (auth.uid() = user_id or public.is_boutique_owner());

drop policy if exists "Owner updates orders" on public.orders;
create policy "Owner updates orders"
  on public.orders for update
  to authenticated
  using (public.is_boutique_owner())
  with check (public.is_boutique_owner());

drop policy if exists "Customer reads own order items; owner reads all" on public.order_items;
create policy "Customer reads own order items; owner reads all"
  on public.order_items for select
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
    or public.is_boutique_owner()
  );

-- ----------------------------------------------------------------------------
-- 14. notifications
-- Customers read & mark-read only their own customer notifications.
-- Owner reads owner notifications & manages all notifications.
-- ----------------------------------------------------------------------------
drop policy if exists "Customer reads own notifications; owner reads owner feed" on public.notifications;
create policy "Customer reads own notifications; owner reads owner feed"
  on public.notifications for select
  to authenticated
  using (
    (target_role = 'customer' and auth.uid() = user_id)
    or public.is_boutique_owner()
  );

drop policy if exists "Customer marks own notifications read" on public.notifications;
create policy "Customer marks own notifications read"
  on public.notifications for update
  to authenticated
  using (target_role = 'customer' and auth.uid() = user_id)
  with check (target_role = 'customer' and auth.uid() = user_id);

drop policy if exists "Owner manages notifications" on public.notifications;
create policy "Owner manages notifications"
  on public.notifications for all
  to authenticated
  using (public.is_boutique_owner())
  with check (public.is_boutique_owner());

-- ----------------------------------------------------------------------------
-- 15. store_settings (Public read; owner write only)
-- ----------------------------------------------------------------------------
drop policy if exists "Public read store settings" on public.store_settings;
create policy "Public read store settings"
  on public.store_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "Owner manages store settings" on public.store_settings;
create policy "Owner manages store settings"
  on public.store_settings for all
  to authenticated
  using (public.is_boutique_owner())
  with check (public.is_boutique_owner());

-- ----------------------------------------------------------------------------
-- Enable Supabase Realtime for notifications & orders (RLS enforced!)
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
