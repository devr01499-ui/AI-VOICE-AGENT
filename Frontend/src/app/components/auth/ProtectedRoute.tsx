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

  // 2. Unauthenticated: Redirect to login / AuthGateway with session redirect memory
  if (!session) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-slate-200/80 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              Authentication Required
            </h2>
            <p className="text-sm text-slate-500 font-medium">
              Please sign in or create an account to access your dedicated Claritiy Voice workspace.
            </p>
          </div>

          <AuthGateway onSuccess={() => {
            if (onSuccessRedirect) onSuccessRedirect();
          }} />
        </div>
      </div>
    );
  }

  // 3. Authenticated: Render protected view
  return <>{children}</>;
};

export default ProtectedRoute;
