import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, SUPABASE_CONFIG_WARNING } from '../lib/supabase';
import {
  BOUTIQUE_EMPTY_PROFILE,
  fetchCustomerProfile,
  getCurrentSession,
  isDevGuestAccessEnabled,
  signInWithGoogle,
  signOutCustomer,
  subscribeToAuthChanges,
  updateCustomerProfile,
} from '../services/auth.service';
import type { CustomerProfile } from '../types/boutique';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: CustomerProfile;
  authLoading: boolean;
  isSigningIn: boolean;
  authError: string | null;
  isConfigured: boolean;
  configWarning: string | null;
  isAuthenticated: boolean;
  isDevGuestEnabled: boolean;
  isDevGuestSession: boolean;
  loginWithGoogle: () => Promise<{ ok: boolean; error: string | null }>;
  logout: () => Promise<void>;
  enterDevGuestMode: () => void;
  exitDevGuestMode: () => void;
  saveProfile: (patch: Partial<CustomerProfile>) => Promise<CustomerProfile>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CustomerProfile>(BOUTIQUE_EMPTY_PROFILE);
  const [authLoading, setAuthLoading] = useState<boolean>(isSupabaseConfigured);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isDevGuestSession, setIsDevGuestSession] = useState<boolean>(false);

  const devGuestEnabled = isDevGuestAccessEnabled();

  const hydrateUserProfile = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    const nextUser = nextSession?.user ?? null;
    setUser(nextUser);

    if (!nextUser) {
      setProfile(BOUTIQUE_EMPTY_PROFILE);
      return;
    }

    setIsDevGuestSession(false);
    try {
      const loadedProfile = await fetchCustomerProfile(nextUser);
      setProfile(loadedProfile);
    } catch (err) {
      setProfile({
        ...BOUTIQUE_EMPTY_PROFILE,
        email: nextUser.email ?? '',
        fullName:
          (typeof nextUser.user_metadata?.full_name === 'string' &&
            nextUser.user_metadata.full_name) ||
          (typeof nextUser.user_metadata?.name === 'string' && nextUser.user_metadata.name) ||
          '',
      });
      setAuthError(
        err instanceof Error ? err.message : 'Signed in, but profile details could not be loaded.'
      );
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    let active = true;

    const initAuth = async () => {
      try {
        const currentSession = await getCurrentSession();
        if (!active) return;
        await hydrateUserProfile(currentSession);
      } catch (err) {
        if (active) {
          setAuthError(
            err instanceof Error ? err.message : 'Unable to restore authentication session.'
          );
        }
      } finally {
        if (active) setAuthLoading(false);
      }
    };

    void initAuth();

    const unsubscribe = subscribeToAuthChanges((nextSession) => {
      if (!active) return;
      void hydrateUserProfile(nextSession).finally(() => {
        if (active) setAuthLoading(false);
      });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [hydrateUserProfile]);

  const loginWithGoogle = useCallback(async () => {
    setAuthError(null);
    if (!isSupabaseConfigured) {
      setAuthError(SUPABASE_CONFIG_WARNING);
      return { ok: false, error: SUPABASE_CONFIG_WARNING };
    }

    setIsSigningIn(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setAuthError(error);
        return { ok: false, error };
      }
      return { ok: true, error: null };
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setAuthError(null);
    setIsDevGuestSession(false);
    const { error } = await signOutCustomer();
    if (error) {
      setAuthError(error);
      return;
    }
    setSession(null);
    setUser(null);
    setProfile(BOUTIQUE_EMPTY_PROFILE);
  }, []);

  const enterDevGuestMode = useCallback(() => {
    if (!devGuestEnabled) return;
    setAuthError(null);
    setIsDevGuestSession(true);
  }, [devGuestEnabled]);

  const exitDevGuestMode = useCallback(() => {
    setIsDevGuestSession(false);
  }, []);

  const saveProfile = useCallback(
    async (patch: Partial<CustomerProfile>): Promise<CustomerProfile> => {
      if (!user) {
        const nextLocal = { ...profile, ...patch };
        setProfile(nextLocal);
        return nextLocal;
      }
      const updated = await updateCustomerProfile(user.id, patch);
      setProfile(updated);
      return updated;
    },
    [profile, user]
  );

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      authLoading,
      isSigningIn,
      authError,
      isConfigured: isSupabaseConfigured,
      configWarning: isSupabaseConfigured ? null : SUPABASE_CONFIG_WARNING,
      isAuthenticated: Boolean(user),
      isDevGuestEnabled: devGuestEnabled,
      isDevGuestSession,
      loginWithGoogle,
      logout,
      enterDevGuestMode,
      exitDevGuestMode,
      saveProfile,
      clearAuthError,
    }),
    [
      user,
      session,
      profile,
      authLoading,
      isSigningIn,
      authError,
      devGuestEnabled,
      isDevGuestSession,
      loginWithGoogle,
      logout,
      enterDevGuestMode,
      exitDevGuestMode,
      saveProfile,
      clearAuthError,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
