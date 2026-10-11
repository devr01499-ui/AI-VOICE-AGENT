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

const AdminRouter: React.FC = () => {
  const { loading } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>('/overview');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Sync with browser URL hash or path
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname || '/overview';
      if (path.startsWith('/customers/')) {
        const id = path.replace('/customers/', '');
        setSelectedCustomerId(id);
        setCurrentPath('/customers');
      } else {
        setSelectedCustomerId(null);
        setCurrentPath(path === '/' ? '/overview' : path);
      }
    };
    handlePopState();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    if (path.startsWith('/customers/')) {
      const id = path.replace('/customers/', '');
      setSelectedCustomerId(id);
      setCurrentPath('/customers');
      window.history.pushState({}, '', path);
    } else {
      setSelectedCustomerId(null);
      setCurrentPath(path);
      window.history.pushState({}, '', path);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center font-bold text-white text-lg shadow-lg shadow-indigo-500/20 mb-4 animate-pulse">
          C
        </div>
        <p className="text-xs font-mono tracking-wider uppercase text-slate-500">
          Claritiy Voice Security Gateway...
        </p>
      </div>
    );
  }

  // Pre-launch mode: Authentication is temporarily bypassed per founder request.
  // Full AAL2 TOTP and role gating will be reinstated prior to live launch.
  /*
  if (user && mfaRequired) {
    return <MfaEnroll />;
  }
  if (!user || !staff) {
    return <Login />;
  }
  */

  // Render current page content
  const renderContent = () => {
    if (selectedCustomerId) {
      return <CustomerDetail customerId={selectedCustomerId} onBack={() => navigate('/customers')} />;
    }
    switch (currentPath) {
      case '/overview':
        return <Overview onNavigate={navigate} />;
      case '/customers':
        return <CustomersList onSelectCustomer={(id) => navigate(`/customers/${id}`)} />;
      case '/calls':
        return <CallsList onSelectCustomer={(id) => navigate(`/customers/${id}`)} />;
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
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium cursor-pointer"
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
