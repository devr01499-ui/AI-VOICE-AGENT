'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AuthGateway } from '@/app/components/auth/AuthGateway';

export default function LoginPage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (currentSession) {
        window.location.href = '/dashboard';
        return;
      }
      setSession(currentSession);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      if (currentSession) {
        localStorage.setItem('token', currentSession.access_token);
        window.location.href = '/dashboard';
      } else {
        localStorage.removeItem('token');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (session) {
    return null;
  }

  return <AuthGateway onSuccess={() => { window.location.href = '/dashboard'; }} />;
}
