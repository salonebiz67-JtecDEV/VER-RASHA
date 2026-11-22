# VEY RASHA — Supabase & GitHub Pages Deployment Guide

This guide covers connecting and deploying the **VEY RASHA** customer application using:

- **GitHub + GitHub Actions + GitHub Pages** for the frontend storefront
- **Supabase** for Google OAuth Authentication, PostgreSQL + Row Level Security, Storage (`boutique-media`), Realtime updates, and Edge Functions
- **Capacitor** for the Android mobile build (sharing the same Supabase project)

> **Architecture Note:** Customer operations no longer depend on a Render backend server. The private Owner Dashboard will live in a separate GitHub repository and connect to the exact same Supabase project via the protected `owner` role in `public.user_roles` and the `owner-process-order` Edge Function.

---

## 1. Create & Configure Your Supabase Project

1. Create a free project in **Supabase** (`https://supabase.com/dashboard`).
2. Note your public project values from **Project Settings → API**:
   - `Project URL` (`VITE_SUPABASE_URL`)
   - `Publishable / anon key` (`VITE_SUPABASE_PUBLISHABLE_KEY`)
3. Never copy `service_role` into `.env`, GitHub Actions `VITE_*` variables, or frontend code.

---

## 2. Apply Database Schema, RLS Policies & Storage Bucket

Run the three SQL migrations in `supabase/migrations/` in order using the Supabase CLI or Dashboard **SQL Editor**:

1. `supabase/migrations/202611220001_initial_schema.sql` — Creates all 15 tables (`profiles`, `user_roles`, `categories`, `products`, `product_images`, `product_variants`, `wishlists`, `wishlist_items`, `carts`, `cart_items`, `addresses`, `orders`, `order_items`, `notifications`, `store_settings`) and the automatic `auth.users` customer profile trigger.
2. `supabase/migrations/202611220002_rls_policies.sql` — Enables Row Level Security on every table, creates `public.is_boutique_owner()`, blocks unauthorized mutations, and adds `notifications` and `orders` to `supabase_realtime`.
3. `supabase/migrations/202611220003_storage_buckets.sql` — Creates the `boutique-media` storage bucket with public read access and owner-only uploads/deletes.

---

## 3. Deploy Edge Functions

Deploy the two Edge Functions in `supabase/functions/`:

```bash
supabase functions deploy create-order
supabase functions deploy owner-process-order
```

Supabase automatically injects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` inside deployed Edge Functions. Verify function logs in **Edge Functions → create-order** after deploying.

---

## 4. Configure Google OAuth Authentication

1. In Google Cloud Console, create an OAuth 2.0 Web Client ID and copy the Client ID + Client Secret into **Supabase → Authentication → Providers → Google**.
2. In Google Cloud Console, add Supabase's callback URL (`https://<your-project-ref>.supabase.co/auth/v1/callback`) as an **Authorized redirect URI**.
3. In **Supabase → Authentication → URL Configuration**, add your frontend URLs to **Redirect URLs**:
   - Local development: `http://localhost:3000/` and `http://localhost:5173/`
   - GitHub Pages: `https://<your-username>.github.io/<repo-name>/`
   - Capacitor Android (deep link / localhost origin as configured in Capacitor)

---

## 5. Assign the Single Boutique Owner Role (For the Separate Owner Repo)

Customers automatically receive `'customer'` in `public.user_roles` when signing in with Google. To authorize the single boutique owner account after the owner signs in once:

```sql
insert into public.user_roles (user_id, role)
values ('<OWNER_AUTH_USER_UUID>', 'owner')
on conflict (user_id, role) do nothing;
```

Only that DB-verified owner account can publish products, upload media to `boutique-media`, and call `owner-process-order`.

---

## 6. Configure GitHub Repository Variables & Deploy to GitHub Pages

1. Open your repository on GitHub → **Settings → Secrets and variables → Actions → Variables**.
2. Add two repository variables:
   - `VITE_SUPABASE_URL` = `https://<your-project-ref>.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = your Supabase publishable/anon key
3. Ensure **Settings → Pages → Build and deployment → Source** is set to **GitHub Actions**.
4. Push to `main` (or trigger `.github/workflows/deploy.yml`). The workflow automatically derives `VITE_BASE_PATH` from your repository name, runs `bun install --frozen-lockfile`, `bun run lint`, and `bun run build`, and deploys `./dist` (including `404.html` SPA fallback).
