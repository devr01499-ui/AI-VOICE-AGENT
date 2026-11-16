import React, { ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import AuthGateway from './AuthGateway';
import BrandSplash from '../common/BrandSplash';
import { GlobalConsentModal } from '../common/GlobalConsentModal';

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
  // 1. While the session is being checked show the same neutral splash as first paint,
  //    so neither the login form nor the dashboard can flash before auth state is known.
  if (authLoading) {
    return <BrandSplash />;
  }

  // 2. Unauthenticated: Render AuthGateway login/signup form cleanly within SPA
  if (!session) {
    return <AuthGateway onSuccess={() => {
      if (onSuccessRedirect) onSuccessRedirect();
    }} />;
  }

  // 3. Authenticated: Render protected view with global consent guard
  return (
    <>
      <GlobalConsentModal
        userEmail={session.user.email}
        userFullName={session.user.user_metadata?.full_name}
      />
      {children}
    </>
  );
};

export default ProtectedRoute;

