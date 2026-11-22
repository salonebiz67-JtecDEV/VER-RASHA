import type { Session, User } from '@supabase/supabase-js';
import { APP_BASE_PATH } from '../config/api';
import { isSupabaseConfigured, supabase, SUPABASE_CONFIG_WARNING } from '../lib/supabase';
import type { CustomerProfile } from '../types/boutique';

export const BOUTIQUE_EMPTY_PROFILE: CustomerProfile = {
  fullName: '',
  email: '',
  phone: '',
  tierLabel: 'Client',
  preferredSize: 'M',
  newsletterOptIn: false,
  smsUpdatesOptIn: true,
};

export function isDevGuestAccessEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_DEV_GUEST_ACCESS === 'true';
}

export function resolveOAuthRedirectUrl(): string {
  if (typeof window === 'undefined') return '';
  const basePath = APP_BASE_PATH.startsWith('/') ? APP_BASE_PATH : `/${APP_BASE_PATH}`;
  return `${window.location.origin}${basePath}`;
}

export async function signInWithGoogle(): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: SUPABASE_CONFIG_WARNING };
  }

  const redirectTo = resolveOAuthRedirectUrl();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        prompt: 'select_account',
      },
    },
  });

  if (error) {
    return { error: error.message || 'Unable to start Google Sign-In.' };
  }

  return { error: null };
}

export async function signOutCustomer(): Promise<{ error: string | null }> {
  if (!supabase) return { error: null };
  const { error } = await supabase.auth.signOut();
  if (error) {
    return { error: error.message || 'Unable to sign out right now.' };
  }
  return { error: null };
}

export async function getCurrentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session;
}

export function subscribeToAuthChanges(
  callback: (session: Session | null) => void
): () => void {
  if (!supabase) return () => undefined;
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, nextSession) => {
    callback(nextSession);
  });
  return () => subscription.unsubscribe();
}

interface DbProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  tier_label: string | null;
  preferred_size: string | null;
  newsletter_opt_in: boolean | null;
  sms_updates_opt_in: boolean | null;
}

function mapProfileRow(row: DbProfileRow | null, user: User): CustomerProfile {
  const metaName =
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
    (typeof user.user_metadata?.name === 'string' && user.user_metadata.name) ||
    '';

  return {
    fullName: row?.full_name?.trim() || metaName,
    email: row?.email?.trim() || user.email || '',
    phone: row?.phone?.trim() || '',
    tierLabel: row?.tier_label?.trim() || 'Client',
    preferredSize: row?.preferred_size?.trim() || 'M',
    newsletterOptIn: Boolean(row?.newsletter_opt_in),
    smsUpdatesOptIn: row?.sms_updates_opt_in ?? true,
  };
}

export async function fetchCustomerProfile(user: User): Promise<CustomerProfile> {
  if (!supabase) {
    return mapProfileRow(null, user);
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, full_name, email, phone, tier_label, preferred_size, newsletter_opt_in, sms_updates_opt_in'
    )
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Unable to load customer profile.');
  }

  if (!data) {
    const initialName =
      (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
      (typeof user.user_metadata?.name === 'string' && user.user_metadata.name) ||
      '';
    const { data: inserted } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          full_name: initialName,
          email: user.email ?? '',
        },
        { onConflict: 'id' }
      )
      .select(
        'id, full_name, email, phone, tier_label, preferred_size, newsletter_opt_in, sms_updates_opt_in'
      )
      .maybeSingle();

    return mapProfileRow((inserted as DbProfileRow | null) ?? null, user);
  }

  return mapProfileRow(data as DbProfileRow, user);
}

export async function updateCustomerProfile(
  userId: string,
  patch: Partial<CustomerProfile>
): Promise<CustomerProfile> {
  if (!supabase) {
    throw new Error(SUPABASE_CONFIG_WARNING);
  }

  const updatePayload: Record<string, unknown> = {};
  if (typeof patch.fullName === 'string') updatePayload.full_name = patch.fullName.trim();
  if (typeof patch.email === 'string') updatePayload.email = patch.email.trim();
  if (typeof patch.phone === 'string') updatePayload.phone = patch.phone.trim();
  if (typeof patch.preferredSize === 'string') {
    updatePayload.preferred_size = patch.preferredSize.trim();
  }
  if (typeof patch.newsletterOptIn === 'boolean') {
    updatePayload.newsletter_opt_in = patch.newsletterOptIn;
  }
  if (typeof patch.smsUpdatesOptIn === 'boolean') {
    updatePayload.sms_updates_opt_in = patch.smsUpdatesOptIn;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', userId)
    .select(
      'id, full_name, email, phone, tier_label, preferred_size, newsletter_opt_in, sms_updates_opt_in'
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Unable to save profile updates.');
  }

  const row = data as DbProfileRow;
  return {
    fullName: row.full_name ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    tierLabel: row.tier_label ?? 'Client',
    preferredSize: row.preferred_size ?? 'M',
    newsletterOptIn: Boolean(row.newsletter_opt_in),
    smsUpdatesOptIn: row.sms_updates_opt_in ?? true,
  };
}
