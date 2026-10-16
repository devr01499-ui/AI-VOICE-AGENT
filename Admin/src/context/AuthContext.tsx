import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { StaffUser, PermissionName } from '../types/admin';
import { adminFetch } from '../lib/api';

interface AuthContextType {
  user: any | null;
  staff: StaffUser | null;
  loading: boolean;
  mfaRequired: boolean;
  error: string | null;
  hasPermission: (perm: PermissionName) => boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithPassword: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshStaff: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkMfaStatus = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!error && data) {
        const needsMfa = data.currentLevel === 'aal1' && data.nextLevel === 'aal2';
        setMfaRequired(needsMfa);
        return needsMfa;
      }
    } catch {
      // MFA evaluation failed
    }
    setMfaRequired(false);
    return false;
  };

  const fetchStaffProfile = async () => {
    try {
      setError(null);
      const res = await adminFetch<{ success: boolean; data: StaffUser }>('/api/v2/admin/me');
      if (res.success && res.data) {
        setStaff(res.data);
      } else {
        setStaff(null);
      }
    } catch (err: any) {
      console.warn('[ADMIN_AUTH] Failed to fetch staff profile', err);
      setStaff(null);
      setError(err?.message || 'Failed to verify staff permissions');
    }
  };

  useEffect(() => {
    // Initial session load
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        const needsMfa = await checkMfaStatus();
        if (!needsMfa) {
          await fetchStaffProfile();
        }
      } else {
        setUser(null);
        setStaff(null);
      }
      setLoading(false);
    });

    // Auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        const needsMfa = await checkMfaStatus();
        if (!needsMfa) {
          await fetchStaffProfile();
        }
      } else {
        setUser(null);
        setStaff(null);
        setMfaRequired(false);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const hasPermission = (permission: PermissionName): boolean => {
    if (!staff) return false;
    if (staff.role === 'owner') return true;
    return !!staff.permissions?.includes(permission);
  };

  const signInWithGoogle = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/overview`,
      },
    });
    if (error) throw error;
  };

  const signInWithPassword = async (email: string, pass: string) => {
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (error) throw error;
    setUser(data.user);
    const needsMfa = await checkMfaStatus();
    if (!needsMfa) {
      await fetchStaffProfile();
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setStaff(null);
    setMfaRequired(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        staff,
        loading,
        mfaRequired,
        error,
        hasPermission,
        signInWithGoogle,
        signInWithPassword,
        signOut,
        refreshStaff: fetchStaffProfile,
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
