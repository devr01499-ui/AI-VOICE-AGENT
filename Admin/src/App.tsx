import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminLayout } from './components/Layout/AdminLayout';
import { Overview } from './pages/Overview';
import { CustomersList } from './pages/CustomersList';
import { CustomerDetail } from './pages/CustomerDetail';
import { CallsList } from './pages/CallsList';
import { NumbersList } from './pages/NumbersList';
import { PaymentsList } from './pages/PaymentsList';
import { Health } from './pages/Health';
import { AuditLogsList } from './pages/AuditLogsList';
import { StaffList } from './pages/StaffList';
import { PlansList } from './pages/PlansList';
import { Settings } from './pages/Settings';
import { ControlPanel } from './pages/ControlPanel';
import { KycList } from './pages/KycList';
import { UsagePage } from './pages/UsagePage';
import { Login } from './pages/Login';
import { MfaEnroll } from './pages/MfaEnroll';

const AdminRouter: React.FC = () => {
  const { user, staff, mfaRequired, accessDenied, error: authError, loading, signOut, recheck } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>('/overview');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const isSubPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
  const basePath = isSubPath ? '/admin' : '';

  const normalizePath = (rawPath: string) => {
    let p = rawPath;
    if (p.startsWith('/admin')) {
      p = p.replace(/^\/admin/, '') || '/overview';
    }
    if (['', '/'].includes(p)) {
      p = '/overview';
    }
    return p;
  };

  // Sync with browser URL hash or path
  useEffect(() => {
    const handlePopState = () => {
      let path = normalizePath(window.location.pathname || '/overview');
      if (['', '/'].includes(path)) {
        path = '/overview';
        window.history.replaceState({}, '', `${basePath}/overview`);
      }
      if (path.startsWith('/customers/')) {
        const id = path.replace('/customers/', '');
        setSelectedCustomerId(id);
        setCurrentPath('/customers');
      } else {
        setSelectedCustomerId(null);
        setCurrentPath(path);
      }
    };
    handlePopState();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [basePath]);

  const navigate = (path: string) => {
    let cleanPath = normalizePath(path);
    if (cleanPath.startsWith('/customers/')) {
      const id = cleanPath.replace('/customers/', '');
      setSelectedCustomerId(id);
      setCurrentPath('/customers');
      window.history.pushState({}, '', `${basePath}${cleanPath}`);
    } else {
      setSelectedCustomerId(null);
      setCurrentPath(cleanPath);
      window.history.pushState({}, '', `${basePath}${cleanPath}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-zinc-400">
        <div className="h-10 w-10 rounded-xl bg-white text-black flex items-center justify-center font-bold text-lg shadow-sm mb-4 animate-pulse">
          C
        </div>
        <p className="text-xs font-mono tracking-wider uppercase text-zinc-500">
          Claritiy Voice Security Gateway...
        </p>
      </div>
    );
  }

  // Strict Authentication Gate: Unauthenticated users are served the Login portal
  if (!user) {
    return <Login onSuccess={() => navigate('/overview')} />;
  }

  // Strict MFA Gate: AAL2 step-up required before accessing internal console
  if (mfaRequired) {
    return <MfaEnroll onVerified={() => navigate('/overview')} />;
  }

  // Signed in, but the server did not confirm an active staff member (or could not be reached):
  // never render the console shell without a verified staff profile.
  if (!staff) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 text-white">
        <div className="max-w-md w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4 text-center">
          <h1 className="text-base font-bold">{accessDenied ? 'No access to the admin console' : 'Could not open the console'}</h1>
          <p className="text-xs text-zinc-400 break-words">
            {accessDenied || authError || 'The server did not confirm your staff access.'}
          </p>
          <p className="text-[11px] text-zinc-500 break-all">Signed in as {user.email}</p>
          <div className="flex justify-center gap-2">
            {!accessDenied && (
              <button onClick={() => recheck()} className="px-4 py-2 bg-white text-black font-semibold rounded-xl text-xs cursor-pointer">Try again</button>
            )}
            <button onClick={() => signOut()} className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl text-xs cursor-pointer">Sign out</button>
          </div>
        </div>
      </div>
    );
  }

  // Render current page content
  const renderContent = () => {
    if (selectedCustomerId) {
      return <CustomerDetail customerId={selectedCustomerId} onBack={() => navigate('/customers')} />;
    }
    switch (currentPath) {
      case '/':
      case '/login':
      case '/signin':
      case '/mfa':
      case '/overview':
        return <Overview onNavigate={navigate} />;
      case '/customers':
        return <CustomersList onSelectCustomer={(id) => navigate(`/customers/${id}`)} />;
      case '/calls':
        return <CallsList onSelectCustomer={(id) => navigate(`/customers/${id}`)} />;
      case '/usage':
        return <UsagePage onSelectCustomer={(id) => navigate(`/customers/${id}`)} />;
      case '/numbers':
        return <NumbersList onSelectCustomer={(id) => navigate(`/customers/${id}`)} />;
      case '/payments':
        return <PaymentsList onSelectCustomer={(id) => navigate(`/customers/${id}`)} />;
      case '/plans':
        return <PlansList />;
      case '/staff':
        return <StaffList />;
      case '/health':
        return <Health />;
      case '/audit-logs':
        return <AuditLogsList />;
      case '/settings':
        return <Settings />;
      case '/control':
        return <ControlPanel />;
      case '/kyc':
        return <KycList onSelectCustomer={(id) => navigate(`/customers/${id}`)} />;
      default:
        return (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
            <h2 className="text-lg font-bold text-white capitalize">
              {currentPath.replace('/', '')} View
            </h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              This operational module is wired to backend contracts. You can navigate back to Overview or Customers.
            </p>
            <button
              onClick={() => navigate('/overview')}
              className="px-4 py-2 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl text-xs cursor-pointer"
            >
              Go to Overview
            </button>
          </div>
        );
    }
  };

  // Authenticated Console Shell
  return (
    <AdminLayout currentPath={selectedCustomerId ? `/customers/${selectedCustomerId}` : currentPath} onNavigate={navigate}>
      {renderContent()}
    </AdminLayout>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AdminRouter />
    </AuthProvider>
  );
};
