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
  const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'calls' | 'notes' | 'audit'>('overview');

  // Sub-resources
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);

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
      if (activeTab === 'ledger') {
        const res = await adminFetch<{ success: boolean; data: any[] }>(`/api/v2/admin/customers/${customerId}/ledger`);
        if (res.success) setLedgerEntries(res.data);
      } else if (activeTab === 'calls') {
        const res = await adminFetch<{ success: boolean; data: any[] }>(`/api/v2/admin/customers/${customerId}/calls`);
        if (res.success) setCalls(res.data);
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
      const res = await adminFetch(`/api/v2/admin/customers/${customerId}/revoke-api-keys`, { method: 'POST' });
      alert(`Revoked ${res.revokedCount || 0} API keys.`);
      fetchCustomer();
    } catch (err: any) {
      alert(err.message || 'Failed to revoke keys');
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-500">
        <div className="h-6 w-6 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">Loading Customer 360 profile...</p>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl">
        <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-3" />
        <h2 className="text-base font-semibold text-white">Customer Not Found</h2>
        <p className="text-xs text-slate-400 mt-1">{error || 'Could not locate customer with the requested ID.'}</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium cursor-pointer"
        >
          Return to Directory
        </button>
      </div>
    );
  }

  const minutesRemaining = Math.round((customer.minutesRemainingSeconds || 0) / 60);

  return (
    <div className="space-y-6">
      {/* Top Bar with Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Customers</span>
        </button>
        <span className="text-[11px] font-mono text-slate-500">ID: {customer.id}</span>
      </div>

      {/* Customer 360 Hero Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white font-bold text-xl shrink-0">
              {customer.fullName ? customer.fullName[0].toUpperCase() : 'U'}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {customer.fullName || 'Anonymous Customer'}
                </h1>
                <span
                  className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono uppercase font-semibold border ${
                    customer.accountStatus === 'active'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : customer.accountStatus === 'restricted'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}
                >
                  {customer.accountStatus}
                </span>
                {customer.adminProfile?.riskLevel && customer.adminProfile.riskLevel !== 'none' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                    RISK: {customer.adminProfile.riskLevel}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-1">{customer.email}</p>
              {customer.contactNumber && (
                <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <Phone className="h-3 w-3 text-slate-500" />
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
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
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
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs cursor-pointer border border-slate-700"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}

            {hasPermission('security:revoke_keys') && (
              <button
                onClick={handleRevokeKeys}
                title="Revoke API Keys"
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs cursor-pointer border border-slate-700"
              >
                <Key className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Balance Metric Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <span className="text-[11px] font-mono uppercase text-slate-400">Available Minutes</span>
            <div className="text-xl font-bold font-mono text-white mt-1">
              {minutesRemaining} <span className="text-xs text-slate-400 font-sans">mins</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              ({customer.minutesRemainingSeconds || 0} seconds)
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <span className="text-[11px] font-mono uppercase text-slate-400">Total Minutes Consumed</span>
            <div className="text-xl font-bold font-mono text-slate-200 mt-1">
              {customer.totalMinutesConsumed?.toFixed(1) || 0} <span className="text-xs text-slate-400 font-sans">mins</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Across all agents</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <span className="text-[11px] font-mono uppercase text-slate-400">Legacy Credits</span>
            <div className="text-xl font-bold font-mono text-slate-300 mt-1">
              ₹{(customer.billingBalance || 0).toFixed(2)}
            </div>
            <span className="text-[9px] text-amber-400/80 font-mono uppercase">Read-only legacy metric</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <span className="text-[11px] font-mono uppercase text-slate-400">Total Spent</span>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
              ₹{(customer.stats?.totalSpentInr || 0).toLocaleString()}
            </div>
            <span className="text-[10px] text-slate-500 font-mono">{customer.stats?.callsCount || 0} total calls</span>
          </div>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="border-b border-slate-800 flex items-center gap-6 text-xs font-medium">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'ledger', label: 'Minutes Ledger' },
          { key: 'calls', label: 'Calls' },
          { key: 'notes', label: 'Notes & Follow-ups' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`pb-3 border-b-2 transition-colors cursor-pointer ${
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
              Account Metadata
            </h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Account Type</span>
                <span className="font-mono text-white capitalize">{customer.accountType}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Company GSTIN</span>
                <span className="font-mono text-white">{customer.companyGstin || 'Not provided'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Vobiz Sub-Account</span>
                <span className="font-mono text-white">
                  {customer.vobizSubAccount?.authId || 'None (shared master)'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Registered At</span>
                <span className="font-mono text-white">
                  {new Date(customer.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Last Seen</span>
                <span className="font-mono text-white">
                  {customer.lastSeenAt ? new Date(customer.lastSeenAt).toLocaleString() : 'Never'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
              CRM & Governance Settings
            </h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Assigned Staff</span>
                <span className="font-mono text-white">
                  {customer.adminProfile?.assignedStaffId || 'Unassigned'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Risk Profile</span>
                <span className="font-mono text-white uppercase font-semibold">
                  {customer.adminProfile?.riskLevel || 'None'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Configured Phone Numbers</span>
                <span className="font-mono text-white">
                  {customer.phoneNumbers?.length || 0} numbers
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Configured Voice Agents</span>
                <span className="font-mono text-white">{customer.stats?.agentsCount || 0} agents</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Minutes Ledger */}
      {activeTab === 'ledger' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-white uppercase font-mono">Minutes Transaction Ledger</h3>
              <p className="text-[11px] text-slate-400">
                Immutable, append-only financial audit trail for this customer.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3 font-semibold">Date & Time</th>
                  <th className="px-4 py-3 font-semibold">Delta</th>
                  <th className="px-4 py-3 font-semibold">Reason</th>
                  <th className="px-4 py-3 font-semibold">Actor</th>
                  <th className="px-4 py-3 font-semibold">Balance After</th>
                  <th className="px-4 py-3 font-semibold">Idempotency Key</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {ledgerEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-500">
                      No ledger transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  ledgerEntries.map((e) => {
                    const isCredit = e.deltaSeconds > 0;
                    const deltaMins = (Math.abs(e.deltaSeconds) / 60).toFixed(1);
                    return (
                      <tr key={e.id} className="hover:bg-slate-800/40 font-mono">
                        <td className="px-5 py-3 text-slate-400 text-[11px]">
                          {new Date(e.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded font-bold ${
                              isCredit ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
                            }`}
                          >
                            {isCredit ? `+${deltaMins}` : `-${deltaMins}`} min
                          </span>
                        </td>
                        <td className="px-4 py-3 font-sans text-white capitalize">{e.reason.replace('_', ' ')}</td>
                        <td className="px-4 py-3 text-slate-400 text-[11px] uppercase">
                          {e.actorType} {e.actorId ? `(${e.actorId.slice(0, 8)})` : ''}
                        </td>
                        <td className="px-4 py-3 font-bold text-white">
                          {(e.balanceAfterSeconds / 60).toFixed(1)} min
                        </td>
                        <td className="px-4 py-3 text-[10px] text-slate-500 truncate max-w-xs">
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

      {/* Tab 3: Calls */}
      {activeTab === 'calls' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-950/80 border-b border-slate-800">
            <h3 className="text-xs font-bold text-white uppercase font-mono">Call History</h3>
            <p className="text-[11px] text-slate-400">Recent calls placed or received by this customer.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3 font-semibold">Recipient</th>
                  <th className="px-4 py-3 font-semibold">Direction</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Duration</th>
                  <th className="px-4 py-3 font-semibold">Agent</th>
                  <th className="px-4 py-3 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {calls.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-500">
                      No calls recorded for this customer.
                    </td>
                  </tr>
                ) : (
                  calls.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/40">
                      <td className="px-5 py-3 font-mono text-white">{c.recipientPhoneNumber}</td>
                      <td className="px-4 py-3 capitalize text-slate-400">{c.callDirection || 'outbound'}</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase bg-slate-800 text-slate-300">
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-200">
                        {Math.floor((c.durationSeconds || 0) / 60)}m {(c.durationSeconds || 0) % 60}s
                      </td>
                      <td className="px-4 py-3 text-slate-300">{c.agent?.name || 'Default'}</td>
                      <td className="px-4 py-3 text-[11px] font-mono text-slate-400">
                        {new Date(c.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: CRM Notes & Follow-ups */}
      {activeTab === 'notes' && (
        <div className="space-y-6">
          {/* Add Note Form */}
          <form onSubmit={handleAddNote} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
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
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span className="font-semibold text-white">{n.staffEmail || 'Staff Member'}</span>
                    <span className="font-mono">{new Date(n.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-slate-200 whitespace-pre-wrap">{n.body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Scheduled Follow-ups */}
          {followUps.length > 0 && (
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <h4 className="text-xs font-semibold text-white uppercase font-mono">Scheduled Follow-Ups</h4>
              <div className="space-y-2">
                {followUps.map((f) => (
                  <div key={f.id} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                      <div>
                        <p className="font-medium text-white">{f.note}</p>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          Due: {new Date(f.dueAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {f.doneAt ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                        COMPLETED
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1 capitalize">
              {actionModal === 'grant' && 'Grant Promotional Minutes'}
              {actionModal === 'deduct' && 'Deduct Minutes'}
              {actionModal === 'suspend' && 'Suspend Customer Account'}
              {actionModal === 'restrict' && 'Restrict Customer Account'}
              {actionModal === 'restore' && 'Restore Customer Account'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
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
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Minutes Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={modalInput.minutes}
                    onChange={(e) => setModalInput({ ...modalInput, minutes: parseInt(e.target.value, 10) || 0 })}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
              )}

              {actionModal === 'suspend' && (
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Suspension Category</label>
                  <select
                    value={modalInput.category}
                    onChange={(e) => setModalInput({ ...modalInput, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
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
                    className="rounded bg-slate-950 border-slate-800"
                  />
                  <label htmlFor="allowNegative" className="text-xs text-slate-300">
                    Allow balance to go negative (Owner override)
                  </label>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Mandatory Audit Reason</label>
                <textarea
                  value={modalInput.reason}
                  onChange={(e) => setModalInput({ ...modalInput, reason: e.target.value })}
                  placeholder="Detailed justification for this administrative operation..."
                  required
                  rows={3}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs cursor-pointer"
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
