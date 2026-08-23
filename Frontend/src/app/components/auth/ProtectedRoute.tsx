import React, { ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import AuthGateway from './AuthGateway';
import { RefreshCw } from 'lucide-react';

interface ProtectedRouteProps {
  session: Session | null;
  authLoading: boolean;
  onSuccessRedirect?: () => void;
  children: ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  session,
  authLoading,
  onSuccessRedirect,
  children
}) => {
  // 1. Display loading skeleton while session is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center space-y-4 font-sans">
        <div className="w-10 h-10 border-3 border-emerald-500/20 border-t-emerald-600 rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-600 tracking-tight font-mono">
          Verifying Workspace Credentials…
        </p>
      </div>
    );
  }

  // 2. Unauthenticated: Redirect to login page
  if (!session) {
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return <AuthGateway onSuccess={() => {
      if (onSuccessRedirect) onSuccessRedirect();
    }} />;
  }

  // 3. Authenticated: Render protected view
  return <>{children}</>;
};

export default ProtectedRoute;
