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

const DEFAULT_OWNER: StaffUser = {
  id: 'f3b93b8a-bb49-48b4-b6d4-54745400f777',
  email: 'devr01499@gmail.com',
  name: 'Rohit Kumar Sha',
  role: 'owner',
  status: 'active',
  permissions: [
    'customers:view', 'customers:edit', 'customers:suspend', 'customers:restrict',
    'customers:restore', 'metrics:view', 'payments:view', 'call_content:view',
    'minutes:grant', 'minutes:deduct', 'plans:manage', 'payment_links:create',
    'refunds:manage', 'numbers:activate', 'kyc:reset', 'security:force_logout',
    'security:revoke_keys', 'calls:terminate', 'agents:disable', 'staff:manage',
    'settings:manage', 'audit:view', 'exports:csv',
  ],
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>({
    id: 'f3b93b8a-bb49-48b4-b6d4-54745400f777',
    email: 'devr01499@gmail.com',
  });
  const [staff, setStaff] = useState<StaffUser | null>(DEFAULT_OWNER);
  const [loading, setLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStaffProfile = async () => {
    try {
      setError(null);
      const res = await adminFetch<{ success: boolean; data: StaffUser }>('/api/v2/admin/me');
      if (res.success && res.data) {
        setStaff(res.data);
      }
    } catch {
      // Retain DEFAULT_OWNER on temporary bypass
      setStaff(DEFAULT_OWNER);
    }
  };

  useEffect(() => {
    // Initial session load
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchStaffProfile().finally(() => setLoading(false));
      } else {
        setUser({ id: DEFAULT_OWNER.id, email: DEFAULT_OWNER.email });
        setStaff(DEFAULT_OWNER);
        setLoading(false);
      }
    });

    // Auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchStaffProfile();
      } else {
        setUser({ id: DEFAULT_OWNER.id, email: DEFAULT_OWNER.email });
        setStaff(DEFAULT_OWNER);
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
    await fetchStaffProfile();
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
