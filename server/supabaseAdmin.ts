import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedAdminClient: SupabaseClient | null | undefined;

function readServerSupabaseUrl(): string {
  return (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
}

function readServerServiceRoleKey(): string {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(readServerSupabaseUrl() && readServerServiceRoleKey());
}

/**
 * Server-side Supabase client initialized strictly with SUPABASE_SERVICE_ROLE_KEY.
 * NEVER import this module inside `src/` or expose the key to client bundles.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (cachedAdminClient !== undefined) {
    return cachedAdminClient;
  }

  const url = readServerSupabaseUrl();
  const serviceRoleKey = readServerServiceRoleKey();
  if (!url || !serviceRoleKey) {
    cachedAdminClient = null;
    return cachedAdminClient;
  }

  cachedAdminClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cachedAdminClient;
}

/**
 * Verifies a Supabase Auth Bearer JWT on the server and checks `public.user_roles`
 * directly in PostgreSQL to confirm DB-assigned `owner` privileges.
 */
export async function verifySupabaseOwnerBearer(
  bearerToken: string
): Promise<{ userId: string } | null> {
  const admin = getSupabaseAdmin();
  if (!admin || !bearerToken) return null;

  try {
    const { data: authData, error: authErr } = await admin.auth.getUser(bearerToken);
    if (authErr || !authData.user) {
      return null;
    }

    const { data: roleRow, error: roleErr } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', authData.user.id)
      .eq('role', 'owner')
      .maybeSingle();

    if (roleErr || !roleRow) {
      return null;
    }

    return { userId: authData.user.id };
  } catch {
    return null;
  }
}
