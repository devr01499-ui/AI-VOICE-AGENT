import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { StaffUser, PermissionName } from '../types/admin';
import { adminFetch, AdminApiError } from '../lib/api';

interface AuthContextType {
  user: any | null;
  staff: StaffUser | null;
  loading: boolean;
  /** True when the server (or Supabase) needs a two-factor step before the console opens. */
  mfaRequired: boolean;
  /** Signed in, but not an active staff member (or the server refused for another reason). */
  accessDenied: string | null;
  error: string | null;
  hasPermission: (perm: PermissionName) => boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithPassword: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshStaff: () => Promise<void>;
  /** Re-checks two-factor level and staff access (call after a successful 2FA code). */
  recheck: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const checking = useRef<Promise<void> | null>(null);

  /** Supabase side: a factor is enrolled but this session has not passed it yet. */
  const needsChallenge = async (): Promise<boolean> => {
    try {
      const { data, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!aalError && data) return data.currentLevel === 'aal1' && data.nextLevel === 'aal2';
    } catch {
      // fall through: the server decides below
    }
    return false;
  };

  /** Server side: is this person an active staff member with two-factor done? */
  const fetchStaffProfile = useCallback(async () => {
    try {
      setError(null);
      const res = await adminFetch<{ success: boolean; data: StaffUser }>('/api/v2/admin/me');
      setStaff(res.data || null);
      setAccessDenied(null);
      setMfaRequired(false);
    } catch (err: any) {
      setStaff(null);
      const e = err as AdminApiError;
      if (e?.code === 'MFA_REQUIRED') {
        // Not enrolled yet, or the session is not at the two-factor level: show the 2FA screen.
        setMfaRequired(true);
        setAccessDenied(null);
      } else if (e?.status === 403 || e?.status === 401) {
        setAccessDenied(e.message || 'This account does not have access to the admin console.');
      } else {
        setError(e?.message || 'Could not reach the server. Please try again.');
      }
    }
  }, []);

  const evaluate = useCallback(async () => {
    if (checking.current) return checking.current;
    checking.current = (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setUser(null);
        setStaff(null);
        setMfaRequired(false);
        setAccessDenied(null);
        return;
      }
      setUser(session.user);
      if (await needsChallenge()) {
        setStaff(null);
        setMfaRequired(true);
        return;
      }
      await fetchStaffProfile();
    })().finally(() => {
      checking.current = null;
      setLoading(false);
    });
    return checking.current;
  }, [fetchStaffProfile]);

  useEffect(() => {
    evaluate();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Token refreshes do not change who is signed in; everything else is re-checked.
      if (event === 'TOKEN_REFRESHED') return;
      // Defer: Supabase forbids awaiting its own calls inside this callback.
      setTimeout(() => { evaluate(); }, 0);
    });
    return () => subscription.unsubscribe();
  }, [evaluate]);

  const hasPermission = (permission: PermissionName): boolean => {
    if (!staff) return false;
    return !!staff.permissions?.includes(permission);
  };

  const signInWithGoogle = async () => {
    setError(null);
    // The console is served both on its own domain and under /admin on the main site: come back to
    // the console, not to the customer app's /overview.
    const base = window.location.pathname.startsWith('/admin') ? '/admin' : '';
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${base}/overview` },
    });
    if (oauthError) throw oauthError;
  };

  const signInWithPassword = async (email: string, pass: string) => {
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
    if (signInError) throw signInError;
    await evaluate();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setStaff(null);
    setMfaRequired(false);
    setAccessDenied(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        staff,
        loading,
        mfaRequired,
        accessDenied,
        error,
        hasPermission,
        signInWithGoogle,
        signInWithPassword,
        signOut,
        refreshStaff: fetchStaffProfile,
        recheck: evaluate,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
