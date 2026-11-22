import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
const rawSupabasePublishableKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
).trim();

export const SUPABASE_URL = rawSupabaseUrl;
export const isSupabaseConfigured = Boolean(rawSupabaseUrl && rawSupabasePublishableKey);

export const SUPABASE_CONFIG_WARNING =
  'Supabase is not yet configured for this environment. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your .env file (or GitHub Actions repository variables) to enable Google Sign-In, live products, bag sync, orders, and real-time updates.';

let clientInstance: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  clientInstance = createClient(rawSupabaseUrl, rawSupabasePublishableKey, {
    auth: {
      flowType: 'pkce',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}

export const supabase: SupabaseClient | null = clientInstance;

export function requireSupabaseClient(): SupabaseClient {
  if (!clientInstance) {
    throw new Error(SUPABASE_CONFIG_WARNING);
  }
  return clientInstance;
}
