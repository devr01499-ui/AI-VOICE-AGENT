'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AuthGateway } from '@/app/components/auth/AuthGateway';
import { DashboardOverview } from '@/app/components/dashboard/DashboardOverview';

export default function DashboardPage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      if (currentSession) {
        localStorage.setItem('token', currentSession.access_token);
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

  if (!session) {
    return <AuthGateway onSuccess={() => window.location.reload()} />;
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-1">Workspace Dashboard</h1>
          <p className="text-sm text-slate-500 font-medium">Manage voice AI agents, phone numbers, and call activity.</p>
        </div>
        <DashboardOverview />
      </div>
    </div>
  );
}
