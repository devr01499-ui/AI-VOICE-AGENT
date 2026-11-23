import React, { useEffect, useState } from 'react';
import { adminFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { fmtDate, fmtDateTime } from '../lib/format';
import { Dialog, ErrorNote, ReasonField, reasonOk, fieldClass, labelClass, primaryBtn, secondaryBtn } from '../components/Dialog';
import { Hash, CheckCircle2, AlertCircle, Clock, AlertTriangle, RefreshCw, ShieldAlert, ArrowRight } from 'lucide-react';

interface NumbersListProps {
  onSelectCustomer?: (customerId: string) => void;
}

export const NumbersList: React.FC<NumbersListProps> = ({ onSelectCustomer }) => {
  const [activeTab, setActiveTab] = useState<'numbers' | 'alerts'>('numbers');
  const [numbers, setNumbers] = useState<any[]>([]);
  const [alertsData, setAlertsData] = useState<{
    failedOrders: any[];
    verifiedUsersWithoutNumber: any[];
    systemAlerts: any[];
  }>({
    failedOrders: [],
    verifiedUsersWithoutNumber: [],
    systemAlerts: [],
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const { hasPermission } = useAuth();
  const canResolve = hasPermission('numbers:activate');
  // Resolve dialog: a failed order (after refunding / assigning by hand) or an internal alert.
  const [resolveTarget, setResolveTarget] = useState<{ kind: 'order' | 'alert'; id: string; label: string } | null>(null);
  const [resolution, setResolution] = useState('refunded');
  const [resolveReason, setResolveReason] = useState('');
  const [resolveBusy, setResolveBusy] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  async function loadNumbers() {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await adminFetch<{ success: boolean; data: any[] }>('/api/v2/admin/numbers');
      if (res.success) setNumbers(res.data);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load phone numbers');
    } finally {
      setLoading(false);
    }
  }

  async function loadAlerts() {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await adminFetch<{ success: boolean; data: any }>('/api/v2/admin/provisioning-alerts');
      if (res.success && res.data) {
        setAlertsData(res.data);
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load provisioning alerts');
    } finally {
      setLoading(false);
    }
  }

  async function submitResolve(e: React.FormEvent) {
    e.preventDefault();
    if (!resolveTarget || !reasonOk(resolveReason)) return;
    setResolveBusy(true);
    setResolveError(null);
    try {
      if (resolveTarget.kind === 'order') {
        await adminFetch(`/api/v2/admin/orders/${resolveTarget.id}/resolve`, { method: 'POST', body: JSON.stringify({ resolution, reason: resolveReason.trim() }) });
      } else {
        await adminFetch(`/api/v2/admin/alerts/${resolveTarget.id}/resolve`, { method: 'POST', body: JSON.stringify({ reason: resolveReason.trim() }) });
      }
      setRetryMessage(`${resolveTarget.label} marked as resolved.`);
      setResolveTarget(null);
      loadAlerts();
    } catch (err: any) {
      setResolveError(err?.message || 'Could not resolve');
    } finally {
      setResolveBusy(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'numbers') {
      loadNumbers();
    } else {
      loadAlerts();
    }
  }, [activeTab]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Hash className="h-5 w-5 text-white" />
            <span>Phone Numbers & Provisioning</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Carrier inventory, provisioning oversight, and failure alerting
          </p>
        </div>

        {/* Tab switch buttons */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('numbers')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'numbers' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Active Numbers ({numbers.length})
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'alerts' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-400 hover:text-amber-400'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Alerts / Failed Provisioning
            {alertsData.failedOrders.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono ml-1">
                {alertsData.failedOrders.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {retryMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2 font-mono">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{retryMessage}</span>
        </div>
      )}
      <ErrorNote message={loadError} />

      {activeTab === 'numbers' ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Phone Number</th>
                  <th className="px-4 py-3.5 font-semibold">Provider</th>
                  <th className="px-4 py-3.5 font-semibold">Status</th>
                  <th className="px-4 py-3.5 font-semibold">KYC Verification</th>
                  <th className="px-4 py-3.5 font-semibold">Assigned Customer</th>
                  <th className="px-4 py-3.5 font-semibold">Assigned Agent</th>
                  <th className="px-4 py-3.5 font-semibold">Purchased</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-500">
                      <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-2" />
                      <span>Loading phone numbers...</span>
                    </td>
                  </tr>
                ) : numbers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-500">
                      No phone numbers provisioned on the platform.
                    </td>
                  </tr>
                ) : (
                  numbers.map((n) => (
                    <tr key={n.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-white font-semibold">
                        {n.phoneNumber}
                      </td>
                      <td className="px-4 py-3.5 font-mono uppercase text-slate-400">
                        {n.telephonyProvider}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase font-semibold ${
                            n.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {n.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase font-semibold inline-flex items-center gap-1 ${
                            n.kycStatus === 'verified'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : n.kycStatus === 'pending'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}
                        >
                          {n.kycStatus === 'verified' && <CheckCircle2 className="h-3 w-3" />}
                          {n.kycStatus === 'pending' && <Clock className="h-3 w-3" />}
                          {n.kycStatus === 'failed' && <AlertCircle className="h-3 w-3" />}
                          <span>{n.kycStatus}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => n.userId && onSelectCustomer?.(n.userId)}
                          className={`text-left text-white font-medium block ${
                            onSelectCustomer && n.userId ? 'cursor-pointer hover:text-white hover:underline' : ''
                          }`}
                        >
                          {n.user?.fullName || 'User'}
                        </button>
                        <div className="text-[11px] text-slate-400 font-mono">{n.user?.email}</div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-300">
                        {n.agent?.name || 'Unassigned'}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-slate-400">
                        {fmtDate(n.purchasedAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Failed Phone Number Orders */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <span>Failed Phone Number Orders ({alertsData.failedOrders.length})</span>
              </h2>
              <button
                onClick={loadAlerts}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono"
              >
                <RefreshCw className="h-3 w-3" /> Refresh
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/40 text-[11px] uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Order / Reference</th>
                    <th className="px-4 py-3 font-semibold">Customer</th>
                    <th className="px-4 py-3 font-semibold">Target Number</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Failure Reason</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {alertsData.failedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500 font-mono">
                        No failed orders found. All provisioning flows executing cleanly.
                      </td>
                    </tr>
                  ) : (
                    alertsData.failedOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3 font-mono text-white text-[11px]">
                          {o.id.slice(0, 13)}...
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => o.userId && onSelectCustomer?.(o.userId)}
                            className="text-white hover:underline block text-left"
                          >
                            {o.user?.fullName || 'User'}
                          </button>
                          <span className="text-[11px] text-slate-400 font-mono">{o.user?.email}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-white">
                          {o.selectedNumber}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase bg-red-500/10 text-red-400 border border-red-500/20 font-semibold">
                            {o.orderStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-red-300 max-w-xs truncate" title={o.failureReason}>
                          {o.failureReason || 'Operational provider error'}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                          {fmtDateTime(o.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          {canResolve ? (
                            <button
                              onClick={() => { setResolveTarget({ kind: 'order', id: o.id, label: `Order ${o.id.slice(0, 8)}` }); setResolution('refunded'); setResolveReason(''); setResolveError(null); }}
                              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                              title="After you have refunded the customer or assigned the number by hand in the carrier console"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Mark resolved
                            </button>
                          ) : <span className="text-[10px] text-zinc-500">—</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Open internal alerts (e.g. a number bought but not assigned) */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-950/80 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <span>Open provisioning alerts ({alertsData.systemAlerts.length})</span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-1">Fix these in the carrier console (or refund), then mark them handled.</p>
            </div>
            <div className="divide-y divide-slate-800/60">
              {alertsData.systemAlerts.length === 0 ? (
                <p className="text-center py-8 text-slate-500 font-mono text-xs">No open alerts.</p>
              ) : (
                alertsData.systemAlerts.map((a) => (
                  <div key={a.id} className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="text-white font-semibold">{a.title}</p>
                      <p className="text-red-300 break-words mt-0.5">{a.message}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-1">{fmtDateTime(a.createdAt)}</p>
                    </div>
                    {canResolve && (
                      <button
                        onClick={() => { setResolveTarget({ kind: 'alert', id: a.id, label: 'Alert' }); setResolveReason(''); setResolveError(null); }}
                        className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold shrink-0 self-start"
                      >
                        Mark handled
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* KYC-Verified Users with No Phone Number */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-400" />
                <span>KYC-Verified Customers With No Phone Number (&gt;15 min) ({alertsData.verifiedUsersWithoutNumber.length})</span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/40 text-[11px] uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Customer</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">KYC Verified At</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {alertsData.verifiedUsersWithoutNumber.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-slate-500 font-mono">
                        No verified customers waiting for phone number assignment.
                      </td>
                    </tr>
                  ) : (
                    alertsData.verifiedUsersWithoutNumber.map((u) => (
                      <tr key={u.userId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3 text-white font-medium">
                          {u.fullName || 'User'}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-300">
                          {u.email}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                          {fmtDateTime(u.verifiedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => onSelectCustomer?.(u.userId)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 font-mono"
                          >
                            <span>Inspect Customer</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={resolveTarget !== null}
        onClose={() => { if (!resolveBusy) setResolveTarget(null); }}
        title={resolveTarget?.kind === 'order' ? 'Mark this order as resolved' : 'Mark this alert as handled'}
        description={resolveTarget?.kind === 'order'
          ? 'Use this only after the customer was refunded (Payments page) or the number was assigned by hand in the carrier console. It does not buy or retry anything.'
          : 'Removes it from the open alerts list. The record stays in the audit log.'}
      >
        <ErrorNote message={resolveError} />
        <form onSubmit={submitResolve} className="space-y-4">
          {resolveTarget?.kind === 'order' && (
            <div>
              <label className={labelClass}>What was done</label>
              <select value={resolution} onChange={(e) => setResolution(e.target.value)} className={fieldClass}>
                <option value="refunded">Customer refunded</option>
                <option value="assigned_manually">Number assigned by hand in the carrier console</option>
                <option value="other">Other (explain below)</option>
              </select>
            </div>
          )}
          <ReasonField value={resolveReason} onChange={setResolveReason} />
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryBtn} onClick={() => setResolveTarget(null)} disabled={resolveBusy}>Cancel</button>
            <button type="submit" className={primaryBtn} disabled={resolveBusy || !reasonOk(resolveReason)}>{resolveBusy ? 'Saving…' : 'Confirm'}</button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
