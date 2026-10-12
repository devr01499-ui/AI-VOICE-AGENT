import React, { useEffect, useState } from 'react';
import { adminFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Phone,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  Minus,
  ArrowLeft,
  Key,
  LogOut,
  AlertCircle,
  MessageSquare,
  Clock,
  Bot,
  Megaphone,
  FileText,
  ShieldCheck,
} from 'lucide-react';

interface CustomerDetailProps {
  customerId: string;
  onBack: () => void;
}

export const CustomerDetail: React.FC<CustomerDetailProps> = ({ customerId, onBack }) => {
  const { staff, hasPermission } = useAuth();
  const [customer, setCustomer] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'campaigns' | 'calls' | 'payments' | 'ledger' | 'notes'>('overview');

  // Sub-resources
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  // Modals state
  const [actionModal, setActionModal] = useState<'grant' | 'deduct' | 'suspend' | 'restrict' | 'restore' | null>(null);
  const [modalInput, setModalInput] = useState({
    minutes: 60,
    reason: '',
    category: 'payment_fraud',
    allowNegative: false,
    noteText: '',
  });
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchCustomer = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminFetch<{ success: boolean; data: any }>(`/api/v2/admin/customers/${customerId}`);
      if (res.success) {
        setCustomer(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load customer profile');
    } finally {
      setLoading(false);
    }
  };

  const loadTabData = async () => {
    try {
      setTabLoading(true);
      if (activeTab === 'ledger') {
        const res = await adminFetch<{ success: boolean; data: any[] }>(`/api/v2/admin/customers/${customerId}/ledger`);
        if (res.success) setLedgerEntries(res.data);
      } else if (activeTab === 'calls') {
        const res = await adminFetch<{ success: boolean; data: any[] }>(`/api/v2/admin/customers/${customerId}/calls`);
        if (res.success) setCalls(res.data);
      } else if (activeTab === 'agents') {
        const res = await adminFetch<{ success: boolean; data: any[] }>(`/api/v2/admin/customers/${customerId}/agents`);
        if (res.success) setAgents(res.data);
      } else if (activeTab === 'campaigns') {
        const res = await adminFetch<{ success: boolean; data: any[] }>(`/api/v2/admin/customers/${customerId}/campaigns`);
        if (res.success) setCampaigns(res.data);
      } else if (activeTab === 'payments') {
        const res = await adminFetch<{ success: boolean; data: any[] }>(`/api/v2/admin/customers/${customerId}/payments`);
        if (res.success) setPayments(res.data);
      } else if (activeTab === 'notes') {
        const [nRes, fRes] = await Promise.all([
          adminFetch<{ success: boolean; data: any[] }>(`/api/v2/admin/customers/${customerId}/notes`),
          adminFetch<{ success: boolean; data: any[] }>(`/api/v2/admin/customers/${customerId}/follow-ups`),
        ]);
        if (nRes.success) setNotes(nRes.data);
        if (fRes.success) setFollowUps(fRes.data);
      }
    } catch (err: any) {
      console.error('Failed to load tab data', err);
    } finally {
      setTabLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomer();
  }, [customerId]);

  useEffect(() => {
    if (customer) loadTabData();
  }, [activeTab, customer]);

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModal) return;

    try {
      setModalLoading(true);
      setModalError(null);

      if (actionModal === 'grant') {
        await adminFetch(`/api/v2/admin/customers/${customerId}/minutes/grant`, {
          method: 'POST',
          body: JSON.stringify({
            minutes: Number(modalInput.minutes),
            reason: modalInput.reason.trim(),
          }),
        });
      } else if (actionModal === 'deduct') {
        await adminFetch(`/api/v2/admin/customers/${customerId}/minutes/deduct`, {
          method: 'POST',
          body: JSON.stringify({
            minutes: Number(modalInput.minutes),
            reason: modalInput.reason.trim(),
            allowNegative: modalInput.allowNegative,
          }),
        });
      } else if (actionModal === 'suspend') {
        await adminFetch(`/api/v2/admin/customers/${customerId}/suspend`, {
          method: 'POST',
          body: JSON.stringify({
            category: modalInput.category,
            reason: modalInput.reason.trim(),
          }),
        });
      } else if (actionModal === 'restrict') {
        await adminFetch(`/api/v2/admin/customers/${customerId}/restrict`, {
          method: 'POST',
          body: JSON.stringify({
            reason: modalInput.reason.trim(),
          }),
        });
      } else if (actionModal === 'restore') {
        await adminFetch(`/api/v2/admin/customers/${customerId}/restore`, {
          method: 'POST',
          body: JSON.stringify({
            reason: modalInput.reason.trim(),
          }),
        });
      }

      setActionModal(null);
      await fetchCustomer();
      if (activeTab === 'ledger') loadTabData();
    } catch (err: any) {
      setModalError(err.message || 'Operation failed');
    } finally {
      setModalLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalInput.noteText.trim()) return;
    try {
      setModalLoading(true);
      await adminFetch(`/api/v2/admin/customers/${customerId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body: modalInput.noteText.trim() }),
      });
      setModalInput({ ...modalInput, noteText: '' });
      await loadTabData();
    } catch (err: any) {
      alert(err.message || 'Failed to add note');
    } finally {
      setModalLoading(false);
    }
  };

  const handleForceLogout = async () => {
    if (!confirm('Are you sure you want to terminate all active sessions for this customer?')) return;
    try {
      await adminFetch(`/api/v2/admin/customers/${customerId}/force-logout`, { method: 'POST' });
      alert('Customer sessions terminated.');
    } catch (err: any) {
      alert(err.message || 'Failed to terminate sessions');
    }
  };

  const handleRevokeKeys = async () => {
    if (!confirm('Are you sure you want to revoke ALL API keys for this customer? This will break running automations.')) return;
    try {
      const res = await adminFetch<{ revokedCount: number }>(`/api/v2/admin/customers/${customerId}/revoke-api-keys`, { method: 'POST' });
      alert(`Revoked ${res.revokedCount || 0} API keys.`);
      fetchCustomer();
    } catch (err: any) {
      alert(err.message || 'Failed to revoke keys');
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-zinc-500 font-sans">
        <div className="h-6 w-6 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">Loading Customer 360 profile...</p>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="p-8 text-center bg-zinc-950 border border-zinc-800 rounded-2xl font-sans">
        <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-3" />
        <h2 className="text-base font-semibold text-white">Customer Not Found</h2>
        <p className="text-xs text-zinc-400 mt-1">{error || 'Could not locate customer with the requested ID.'}</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-medium cursor-pointer"
        >
          Return to Directory
        </button>
      </div>
    );
  }

  const minutesRemaining = Math.round((customer.minutesRemainingSeconds || 0) / 60);

  // Check for stale in-progress calls
  const staleCallsCount = calls.filter((c) => {
    if (c.status !== 'in_progress' && c.status !== 'ringing') return false;
    const createdAt = new Date(c.createdAt).getTime();
    return Date.now() - createdAt > 2 * 60 * 60 * 1000; // > 2 hours
  }).length;

  return (
    <div className="space-y-6 font-sans">
      {/* Top Bar with Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Customers</span>
        </button>
        <span className="text-[11px] font-mono text-zinc-500">ID: {customer.id}</span>
      </div>

      {/* Customer 360 Hero Card */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white font-bold text-xl shrink-0">
              {customer.fullName ? customer.fullName[0].toUpperCase() : 'U'}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {customer.fullName || 'Anonymous Customer'}
                </h1>
                <span
                  className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono uppercase font-semibold border ${
                    customer.accountStatus === 'active'
                      ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                      : customer.accountStatus === 'restricted'
                      ? 'bg-amber-950/60 text-amber-400 border-amber-800/60'
                      : 'bg-red-950/80 text-red-300 border-red-800 font-bold'
                  }`}
                >
                  {customer.accountStatus}
                </span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full font-mono uppercase font-semibold bg-zinc-900 text-zinc-300 border border-zinc-800">
                  PLAN: {customer.accountType || 'free'}
                </span>
                {customer.adminProfile?.riskLevel && customer.adminProfile.riskLevel !== 'none' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-semibold bg-red-950/60 text-red-400 border border-red-800/60">
                    RISK: {customer.adminProfile.riskLevel}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-1">{customer.email}</p>
              {customer.contactNumber && (
                <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                  <Phone className="h-3 w-3 text-zinc-500" />
                  <span>{customer.contactNumber}</span>
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {hasPermission('minutes:grant') && (
              <button
                onClick={() => {
                  setModalInput({ ...modalInput, minutes: 60, reason: '' });
                  setActionModal('grant');
                }}
                className="px-3 py-2 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Grant Minutes</span>
              </button>
            )}

            {hasPermission('minutes:deduct') && (
              <button
                onClick={() => {
                  setModalInput({ ...modalInput, minutes: 30, reason: '', allowNegative: false });
                  setActionModal('deduct');
                }}
                className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-zinc-800"
              >
                <Minus className="h-3.5 w-3.5" />
                <span>Deduct</span>
              </button>
            )}

            {customer.accountStatus === 'suspended' ? (
              hasPermission('customers:restore') && (
                <button
                  onClick={() => {
                    setModalInput({ ...modalInput, reason: '' });
                    setActionModal('restore');
                  }}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Restore Account</span>
                </button>
              )
            ) : (
              <>
                {hasPermission('customers:restrict') && customer.accountStatus !== 'restricted' && (
                  <button
                    onClick={() => {
                      setModalInput({ ...modalInput, reason: '' });
                      setActionModal('restrict');
                    }}
                    className="px-3 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Restrict</span>
                  </button>
                )}

                {hasPermission('customers:suspend') && (
                  <button
                    onClick={() => {
                      setModalInput({ ...modalInput, reason: '', category: 'payment_fraud' });
                      setActionModal('suspend');
                    }}
                    className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Suspend</span>
                  </button>
                )}
              </>
            )}

            {hasPermission('security:force_logout') && (
              <button
                onClick={handleForceLogout}
                title="Terminate sessions"
                className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs cursor-pointer border border-zinc-800"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}

            {hasPermission('security:revoke_keys') && (
              <button
                onClick={handleRevokeKeys}
                title="Revoke API Keys"
                className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs cursor-pointer border border-zinc-800"
              >
                <Key className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Balance Metric Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-zinc-800">
          <div className="bg-black/60 border border-zinc-800/80 rounded-xl p-3.5">
            <span className="text-[11px] font-mono uppercase text-zinc-400">Available Minutes</span>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
              {minutesRemaining} <span className="text-xs text-zinc-400 font-sans">mins</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">
              ({customer.minutesRemainingSeconds || 0} seconds)
            </span>
          </div>

          <div className="bg-black/60 border border-zinc-800/80 rounded-xl p-3.5">
            <span className="text-[11px] font-mono uppercase text-zinc-400">Total Minutes Consumed</span>
            <div className="text-xl font-bold font-mono text-zinc-200 mt-1">
              {customer.totalMinutesConsumed?.toFixed(1) || 0} <span className="text-xs text-zinc-400 font-sans">mins</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">Across all agents</span>
          </div>

          <div className="bg-black/60 border border-zinc-800/80 rounded-xl p-3.5">
            <span className="text-[11px] font-mono uppercase text-zinc-400">Legacy Credits</span>
            <div className="text-xl font-bold font-mono text-zinc-300 mt-1">
              ₹{(customer.billingBalance || 0).toFixed(2)}
            </div>
            <span className="text-[9px] text-amber-400/80 font-mono uppercase">Read-only legacy metric</span>
          </div>

          <div className="bg-black/60 border border-zinc-800/80 rounded-xl p-3.5">
            <span className="text-[11px] font-mono uppercase text-zinc-400">Total Spent</span>
            <div className="text-xl font-bold font-mono text-white mt-1">
              ₹{(customer.stats?.totalSpentInr || 0).toLocaleString()}
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">{customer.stats?.callsCount || 0} total calls</span>
          </div>
        </div>
      </div>

      {/* Stale Calls Alert if any */}
      {staleCallsCount > 0 && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-600/40 text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              <strong>Warning:</strong> {staleCallsCount} call(s) have been in &apos;in_progress&apos; or &apos;ringing&apos; status for over 2 hours without a webhook completion. Possible orphaned provider session.
            </span>
          </div>
          <button
            onClick={() => setActiveTab('calls')}
            className="text-[11px] text-amber-400 underline hover:text-white cursor-pointer ml-3 shrink-0"
          >
            View Calls
          </button>
        </div>
      )}

      {/* Tabs Header */}
      <div className="border-b border-zinc-800 flex items-center gap-6 text-xs font-medium overflow-x-auto">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'agents', label: `Agents (${customer.stats?.agentsCount ?? 0})` },
          { key: 'campaigns', label: 'Campaigns' },
          { key: 'calls', label: `Calls (${customer.stats?.callsCount ?? 0})` },
          { key: 'payments', label: 'Payments & Invoices' },
          { key: 'ledger', label: 'Minutes Ledger' },
          { key: 'notes', label: 'Notes & Follow-ups' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-white text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Account Metadata */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono">
                Account Metadata
              </h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Account Type</span>
                  <span className="font-mono text-white capitalize">{customer.accountType}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Company GSTIN</span>
                  <span className="font-mono text-white">{customer.companyGstin || 'Not provided'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Vobiz Sub-Account</span>
                  <span className="font-mono text-white">
                    {customer.vobizSubAccount?.authId || 'None (shared master)'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Registered At</span>
                  <span className="font-mono text-white">
                    {new Date(customer.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-400">Last Seen</span>
                  <span className="font-mono text-white">
                    {customer.lastSeenAt ? new Date(customer.lastSeenAt).toLocaleString() : 'Never'}
                  </span>
                </div>
              </div>
            </div>

            {/* KYC Compliance Status */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono flex items-center justify-between">
                <span>KYC & Verification</span>
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
              </h3>
              <div className="space-y-2.5 text-xs">
                {(!customer.kycDocuments || customer.kycDocuments.length === 0) ? (
                  <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 text-xs">
                    No KYC documents uploaded yet.
                  </div>
                ) : (
                  customer.kycDocuments.map((doc: any) => (
                    <div key={doc.id} className="p-2.5 bg-black border border-zinc-800 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="font-mono text-white font-semibold uppercase text-[11px]">
                          {doc.documentType}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                          {doc.panNumber || doc.gstin || doc.aadhaarNumber || 'Document'}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-semibold ${
                          doc.status === 'verified'
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                            : doc.status === 'failed'
                            ? 'bg-red-950/60 text-red-400 border border-red-800/60'
                            : 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                        }`}
                      >
                        {doc.status}
                      </span>
                    </div>
                  ))
                )}
                <div className="pt-2 text-[11px] text-zinc-500">
                  Telephony phone numbers require verified KYC prior to outbound live traffic in India.
                </div>
              </div>
            </div>

            {/* CRM & Governance */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono">
                CRM & Governance
              </h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Assigned Staff</span>
                  <span className="font-mono text-white">
                    {customer.adminProfile?.assignedStaffId || 'Unassigned'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Risk Profile</span>
                  <span className="font-mono text-white uppercase font-semibold">
                    {customer.adminProfile?.riskLevel || 'None'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Configured Numbers</span>
                  <span className="font-mono text-white">
                    {customer.phoneNumbers?.length || 0} numbers
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-400">Configured Agents</span>
                  <span className="font-mono text-white">{customer.stats?.agentsCount || 0} agents</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Agents */}
      {activeTab === 'agents' && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 bg-black border-b border-zinc-800 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-white uppercase font-mono">Customer Voice Agents</h3>
              <p className="text-[11px] text-zinc-400">Autonomous voice assistants created by this user.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-black text-[11px] uppercase tracking-wider text-zinc-400 font-mono border-b border-zinc-800">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Agent Name</th>
                  <th className="px-4 py-3.5 font-semibold">Status</th>
                  <th className="px-4 py-3.5 font-semibold">Model / Engine</th>
                  <th className="px-4 py-3.5 font-semibold">Voice</th>
                  <th className="px-4 py-3.5 font-semibold">Direction</th>
                  <th className="px-4 py-3.5 font-semibold">Calls Made</th>
                  <th className="px-4 py-3.5 font-semibold">Campaigns</th>
                  <th className="px-4 py-3.5 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {tabLoading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-zinc-500">
                      <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-2" />
                      Loading agents...
                    </td>
                  </tr>
                ) : agents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-zinc-500">
                      No agents configured by this customer.
                    </td>
                  </tr>
                ) : (
                  agents.map((a) => (
                    <tr key={a.id} className="hover:bg-zinc-900/40">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-white flex items-center gap-2">
                          <Bot className="h-3.5 w-3.5 text-zinc-400" />
                          <span>{a.name}</span>
                        </div>
                        {a.description && (
                          <div className="text-[11px] text-zinc-400 truncate max-w-xs mt-0.5">{a.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-semibold border ${
                            a.status === 'active'
                              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                              : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-zinc-300">{a.model || 'gemini-2.0-flash'}</td>
                      <td className="px-4 py-3.5 text-zinc-300">{a.voiceName || 'Default'}</td>
                      <td className="px-4 py-3.5 capitalize font-mono text-zinc-400">{a.direction || 'outbound'}</td>
                      <td className="px-4 py-3.5 font-mono text-white font-semibold">{a.callsCount || 0}</td>
                      <td className="px-4 py-3.5 font-mono text-zinc-300">{a.campaignsCount || 0}</td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-zinc-400">
                        {new Date(a.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Campaigns */}
      {activeTab === 'campaigns' && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 bg-black border-b border-zinc-800 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-white uppercase font-mono">Batch Campaigns</h3>
              <p className="text-[11px] text-zinc-400">Bulk voice broadcast and calling batches.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-black text-[11px] uppercase tracking-wider text-zinc-400 font-mono border-b border-zinc-800">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Campaign Name</th>
                  <th className="px-4 py-3.5 font-semibold">Agent</th>
                  <th className="px-4 py-3.5 font-semibold">Status</th>
                  <th className="px-4 py-3.5 font-semibold">Recipients</th>
                  <th className="px-4 py-3.5 font-semibold">Completed</th>
                  <th className="px-4 py-3.5 font-semibold">Failed</th>
                  <th className="px-4 py-3.5 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {tabLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-zinc-500">
                      <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-2" />
                      Loading campaigns...
                    </td>
                  </tr>
                ) : campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-zinc-500">
                      No campaigns found for this customer.
                    </td>
                  </tr>
                ) : (
                  campaigns.map((b) => (
                    <tr key={b.id} className="hover:bg-zinc-900/40">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-white flex items-center gap-2">
                          <Megaphone className="h-3.5 w-3.5 text-zinc-400" />
                          <span>{b.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-zinc-300">{b.agent?.name || 'Default'}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-semibold border ${
                            b.status === 'completed'
                              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                              : b.status === 'failed'
                              ? 'bg-red-950/60 text-red-400 border-red-800/60'
                              : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-white font-semibold">{b.totalRecipients || 0}</td>
                      <td className="px-4 py-3.5 font-mono text-emerald-400">{b.completedCount || 0}</td>
                      <td className="px-4 py-3.5 font-mono text-red-400">{b.failedCount || 0}</td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-zinc-400">
                        {new Date(b.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Calls */}
      {activeTab === 'calls' && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 bg-black border-b border-zinc-800">
            <h3 className="text-xs font-bold text-white uppercase font-mono">Call History</h3>
            <p className="text-[11px] text-zinc-400">All telephone call sessions associated with this customer.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-black text-[11px] uppercase tracking-wider text-zinc-400 font-mono border-b border-zinc-800">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Recipient</th>
                  <th className="px-4 py-3.5 font-semibold">Direction</th>
                  <th className="px-4 py-3.5 font-semibold">Status</th>
                  <th className="px-4 py-3.5 font-semibold">Duration</th>
                  <th className="px-4 py-3.5 font-semibold">Agent</th>
                  <th className="px-4 py-3.5 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {calls.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-zinc-500">
                      No calls recorded for this customer.
                    </td>
                  </tr>
                ) : (
                  calls.map((c) => {
                    const isStale = (c.status === 'in_progress' || c.status === 'ringing') &&
                      Date.now() - new Date(c.createdAt).getTime() > 2 * 60 * 60 * 1000;

                    return (
                      <tr key={c.id} className="hover:bg-zinc-900/40">
                        <td className="px-5 py-3.5 font-mono text-white">{c.recipientPhoneNumber}</td>
                        <td className="px-4 py-3.5 capitalize text-zinc-400">{c.callDirection || 'outbound'}</td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-semibold border ${
                              c.status === 'completed'
                                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                                : c.status === 'failed'
                                ? 'bg-red-950/60 text-red-400 border-red-800/60'
                                : isStale
                                ? 'bg-amber-950/60 text-amber-300 border-amber-600 font-bold animate-pulse'
                                : 'bg-zinc-900 text-zinc-300 border-zinc-700'
                            }`}
                          >
                            {c.status} {isStale ? '(STALE)' : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-zinc-200">
                          {Math.floor((c.durationSeconds || 0) / 60)}m {(c.durationSeconds || 0) % 60}s
                        </td>
                        <td className="px-4 py-3.5 text-zinc-300">{c.agent?.name || 'Default'}</td>
                        <td className="px-4 py-3.5 text-[11px] font-mono text-zinc-400">
                          {new Date(c.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Payments & Invoices */}
      {activeTab === 'payments' && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 bg-black border-b border-zinc-800">
            <h3 className="text-xs font-bold text-white uppercase font-mono">Payment Transactions & Invoices</h3>
            <p className="text-[11px] text-zinc-400">Billing history, plan upgrades, and GST invoices.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-black text-[11px] uppercase tracking-wider text-zinc-400 font-mono border-b border-zinc-800">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Payment / Order ID</th>
                  <th className="px-4 py-3.5 font-semibold">Plan</th>
                  <th className="px-4 py-3.5 font-semibold">Amount</th>
                  <th className="px-4 py-3.5 font-semibold">Status</th>
                  <th className="px-4 py-3.5 font-semibold">Invoice No.</th>
                  <th className="px-4 py-3.5 font-semibold">GST Breakdown</th>
                  <th className="px-4 py-3.5 font-semibold">Date</th>
                  <th className="px-4 py-3.5 font-semibold text-right">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {tabLoading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-zinc-500">
                      <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-2" />
                      Loading payments...
                    </td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-zinc-500">
                      No payment transactions recorded for this customer.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => {
                    const inv = p.invoice;
                    return (
                      <tr key={p.id} className="hover:bg-zinc-900/40">
                        <td className="px-5 py-3.5">
                          <div className="font-mono text-white text-[11px]">{p.paymentId || p.orderId}</div>
                          {p.source && (
                            <div className="text-[10px] text-zinc-500 uppercase font-mono mt-0.5">
                              Src: {p.source}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-zinc-200">{p.planName}</td>
                        <td className="px-4 py-3.5 font-mono font-semibold text-white">
                          ₹{Number(p.amount || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-semibold border ${
                              p.status === 'paid' || p.status === 'completed'
                                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                                : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-zinc-300">
                          {inv?.invoiceNumber || p.invoiceNo || '—'}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-[11px] text-zinc-400">
                          {inv ? (
                            <div>
                              <span>₹{inv.subtotalInr} + ₹{inv.gstAmountInr} (GST)</span>
                            </div>
                          ) : (
                            <span>18% inclusive</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-[11px] text-zinc-400">
                          {new Date(p.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {inv?.pdfUrl ? (
                            <a
                              href={inv.pdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-zinc-300 hover:text-white underline cursor-pointer"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span>View PDF</span>
                            </a>
                          ) : (
                            <span className="text-[10px] text-zinc-600 font-mono">Not yet generated</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Minutes Ledger */}
      {activeTab === 'ledger' && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 bg-black border-b border-zinc-800 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-white uppercase font-mono">Minutes Transaction Ledger</h3>
              <p className="text-[11px] text-zinc-400">
                Immutable, append-only financial audit trail for this customer.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-black text-[11px] uppercase tracking-wider text-zinc-400 font-mono border-b border-zinc-800">
                <tr>
                  <th className="px-5 py-3 font-semibold">Date & Time</th>
                  <th className="px-4 py-3 font-semibold">Delta</th>
                  <th className="px-4 py-3 font-semibold">Reason</th>
                  <th className="px-4 py-3 font-semibold">Actor</th>
                  <th className="px-4 py-3 font-semibold">Balance After</th>
                  <th className="px-4 py-3 font-semibold">Idempotency Key</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {ledgerEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-zinc-500">
                      No ledger transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  ledgerEntries.map((e) => {
                    const isCredit = e.deltaSeconds > 0;
                    const deltaMins = (Math.abs(e.deltaSeconds) / 60).toFixed(1);
                    return (
                      <tr key={e.id} className="hover:bg-zinc-900/40 font-mono">
                        <td className="px-5 py-3 text-zinc-400 text-[11px]">
                          {new Date(e.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded font-bold ${
                              isCredit ? 'text-emerald-400 bg-emerald-950/60' : 'text-red-400 bg-red-950/60'
                            }`}
                          >
                            {isCredit ? `+${deltaMins}` : `-${deltaMins}`} min
                          </span>
                        </td>
                        <td className="px-4 py-3 font-sans text-white capitalize">{e.reason.replace('_', ' ')}</td>
                        <td className="px-4 py-3 text-zinc-400 text-[11px] uppercase">
                          {e.actorType} {e.actorId ? `(${e.actorId.slice(0, 8)})` : ''}
                        </td>
                        <td className="px-4 py-3 font-bold text-white">
                          {(e.balanceAfterSeconds / 60).toFixed(1)} min
                        </td>
                        <td className="px-4 py-3 text-[10px] text-zinc-500 truncate max-w-xs">
                          {e.idempotencyKey}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: CRM Notes & Follow-ups */}
      {activeTab === 'notes' && (
        <div className="space-y-6">
          {/* Add Note Form */}
          <form onSubmit={handleAddNote} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
            <h3 className="text-xs font-semibold text-white uppercase font-mono mb-2">Add Staff Note</h3>
            <textarea
              value={modalInput.noteText}
              onChange={(e) => setModalInput({ ...modalInput, noteText: e.target.value })}
              placeholder="Record notes from phone call, sales discussion, KYC inquiry, or risk review..."
              rows={3}
              required
              className="w-full p-3 rounded-xl bg-black border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={modalLoading || !modalInput.noteText.trim()}
                className="px-4 py-2 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl text-xs cursor-pointer disabled:opacity-50"
              >
                Save Note
              </button>
            </div>
          </form>

          {/* Notes list */}
          <div className="space-y-3">
            {notes.map((n) => (
              <div key={n.id} className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-start gap-3">
                <MessageSquare className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                    <span className="font-semibold text-white">{n.staffEmail || 'Staff Member'}</span>
                    <span className="font-mono">{new Date(n.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-zinc-200 whitespace-pre-wrap">{n.body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Scheduled Follow-ups */}
          {followUps.length > 0 && (
            <div className="pt-4 border-t border-zinc-800 space-y-3">
              <h4 className="text-xs font-semibold text-white uppercase font-mono">Scheduled Follow-Ups</h4>
              <div className="space-y-2">
                {followUps.map((f) => (
                  <div key={f.id} className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                      <div>
                        <p className="font-medium text-white">{f.note}</p>
                        <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                          Due: {new Date(f.dueAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {f.doneAt ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 font-mono">
                        COMPLETED
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/60 font-mono">
                        PENDING
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Modals */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1 capitalize">
              {actionModal === 'grant' && 'Grant Promotional Minutes'}
              {actionModal === 'deduct' && 'Deduct Minutes'}
              {actionModal === 'suspend' && 'Suspend Customer Account'}
              {actionModal === 'restrict' && 'Restrict Customer Account'}
              {actionModal === 'restore' && 'Restore Customer Account'}
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              All mutating administrative actions are immutably logged with actor identity.
            </p>

            {modalError && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleActionSubmit} className="space-y-4">
              {(actionModal === 'grant' || actionModal === 'deduct') && (
                <div>
                  <label className="block text-xs font-mono uppercase text-zinc-400 mb-1">Minutes Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={modalInput.minutes}
                    onChange={(e) => setModalInput({ ...modalInput, minutes: parseInt(e.target.value, 10) || 0 })}
                    required
                    className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-xl text-xs text-white"
                  />
                </div>
              )}

              {actionModal === 'suspend' && (
                <div>
                  <label className="block text-xs font-mono uppercase text-zinc-400 mb-1">Suspension Category</label>
                  <select
                    value={modalInput.category}
                    onChange={(e) => setModalInput({ ...modalInput, category: e.target.value })}
                    className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-xl text-xs text-white"
                  >
                    <option value="payment_fraud">Payment Fraud</option>
                    <option value="spam_calling">Spam / Robocall Telephony Abuse</option>
                    <option value="unacceptable_use">Unacceptable Use Policy Breach</option>
                    <option value="regulatory_breach">Regulatory / KYC Compliance Breach</option>
                    <option value="unpaid_balance">Unpaid Invoiced Balance</option>
                    <option value="manual_review">Staff Manual Investigation</option>
                  </select>
                </div>
              )}

              {actionModal === 'deduct' && staff?.role === 'owner' && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="allowNegative"
                    checked={modalInput.allowNegative}
                    onChange={(e) => setModalInput({ ...modalInput, allowNegative: e.target.checked })}
                    className="rounded bg-black border-zinc-800"
                  />
                  <label htmlFor="allowNegative" className="text-xs text-zinc-300">
                    Allow balance to go negative (Owner override)
                  </label>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono uppercase text-zinc-400 mb-1">Mandatory Audit Reason</label>
                <textarea
                  value={modalInput.reason}
                  onChange={(e) => setModalInput({ ...modalInput, reason: e.target.value })}
                  placeholder="Detailed justification for this administrative operation..."
                  required
                  rows={3}
                  className="w-full p-3 bg-black border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs cursor-pointer border border-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading || !modalInput.reason.trim()}
                  className="px-4 py-2 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl text-xs cursor-pointer disabled:opacity-50"
                >
                  {modalLoading ? 'Executing...' : 'Confirm Operation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
