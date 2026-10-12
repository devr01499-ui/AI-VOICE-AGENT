import React, { useEffect, useState } from 'react';
import { adminFetch } from '../lib/api';
import {
  Activity,
  PhoneCall,
  Sparkles,
  Database,
  AlertTriangle,
  TrendingDown,
  Search,
  Eye,
  RefreshCw,
} from 'lucide-react';

interface UsagePageProps {
  onSelectCustomer?: (customerId: string) => void;
}

export const UsagePage: React.FC<UsagePageProps> = ({ onSelectCustomer }) => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchUsage = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminFetch<{ success: boolean; data: any }>('/api/v2/admin/usage');
      if (res.success) {
        setData(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load platform usage data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();
  }, []);

  const topConsumers = (data?.topConsumers || []).filter((c: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.email?.toLowerCase().includes(q) ||
      c.fullName?.toLowerCase().includes(q) ||
      c.id?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-white" />
            <span>Usage & Provider Telemetry</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Platform-wide telephony consumption metrics, provider audit trails, and top customer usage
          </p>
        </div>
        <button
          onClick={fetchUsage}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 rounded-xl text-xs font-medium cursor-pointer transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Vobiz Minutes Used */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider">Vobiz Telephony Used</span>
            <PhoneCall className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {loading ? '—' : Number(data?.summary?.totalMinutesUsed || 0).toLocaleString()} <span className="text-xs text-zinc-500 font-sans">mins</span>
          </div>
          <div className="mt-2 text-[10px] text-zinc-500 font-mono flex items-center gap-1.5">
            <Database className="h-3 w-3 text-emerald-400 shrink-0" />
            <span>Source: Internal Ledger ({data?.summary?.callUsageRecordsCount || 0} debits)</span>
          </div>
        </div>

        {/* Minutes Granted */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider">Minutes Credited / Granted</span>
            <TrendingDown className="h-4 w-4 text-emerald-400 rotate-180" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {loading ? '—' : Number(data?.summary?.totalMinutesGranted || 0).toLocaleString()} <span className="text-xs text-zinc-500 font-sans">mins</span>
          </div>
          <div className="mt-2 text-[10px] text-zinc-500 font-mono">
            Purchased plans + admin grants
          </div>
        </div>

        {/* Vobiz Provider Sync Status */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider">Vobiz Telephony Sync</span>
            <span className="h-2 w-2 rounded-full bg-amber-400" />
          </div>
          <div className="text-sm font-bold font-mono text-amber-300">
            Internal Ledger Only
          </div>
          <p className="mt-1.5 text-[10px] text-zinc-500 leading-relaxed">
            Debited locally per call end webhook. Live Vobiz API balance reconciliation not automated.
          </p>
        </div>

        {/* Gemini Provider Usage Status */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider">Gemini Token Telemetry</span>
            <Sparkles className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="text-sm font-bold font-mono text-zinc-400">
            Unavailable
          </div>
          <p className="mt-1.5 text-[10px] text-zinc-500 leading-relaxed">
            Provider tracking not configured. No Gemini token usage table exists in schema.
          </p>
        </div>
      </div>

      {/* Top Consumers Table */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 bg-black border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-white uppercase font-mono">Top Customers by Minutes Consumed</h3>
            <p className="text-[11px] text-zinc-400">Accounts with highest lifetime minutes consumed across all agents.</p>
          </div>
          <div className="w-full sm:w-64 relative">
            <Search className="h-3.5 w-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter customer..."
              className="w-full pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-black text-[11px] uppercase tracking-wider text-zinc-400 font-mono border-b border-zinc-800">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Customer</th>
                <th className="px-4 py-3.5 font-semibold">Plan</th>
                <th className="px-4 py-3.5 font-semibold">Status</th>
                <th className="px-4 py-3.5 font-semibold">Lifetime Consumed</th>
                <th className="px-4 py-3.5 font-semibold">Balance Remaining</th>
                <th className="px-4 py-3.5 font-semibold">Calls</th>
                <th className="px-4 py-3.5 font-semibold">Agents</th>
                <th className="px-4 py-3.5 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-zinc-500">
                    <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading consumption rankings...</span>
                  </td>
                </tr>
              ) : topConsumers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-zinc-500">
                    No customers found matching the search.
                  </td>
                </tr>
              ) : (
                topConsumers.map((c: any) => {
                  const minutesLeft = Math.round((c.minutesRemainingSeconds || 0) / 60);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => onSelectCustomer?.(c.id)}
                      className="hover:bg-zinc-900/40 transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-white group-hover:underline">
                          {c.fullName || 'Anonymous User'}
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono mt-0.5">{c.email}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-mono uppercase bg-zinc-900 text-zinc-300 border border-zinc-800 font-semibold">
                          {c.accountType || 'free'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-semibold border ${
                            c.accountStatus === 'active'
                              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                              : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                          }`}
                        >
                          {c.accountStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-white font-bold text-sm">
                        {Number(c.totalMinutesConsumed || 0).toFixed(1)} <span className="text-[11px] text-zinc-500 font-normal">min</span>
                      </td>
                      <td className="px-4 py-3.5 font-mono">
                        <span className={minutesLeft > 0 ? 'text-emerald-400 font-semibold' : 'text-zinc-400'}>
                          {minutesLeft} min
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-zinc-300">{c.callsCount || 0}</td>
                      <td className="px-4 py-3.5 font-mono text-zinc-300">{c.agentsCount || 0}</td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCustomer?.(c.id);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white text-black hover:bg-zinc-200 text-[11px] font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="h-3 w-3" />
                          <span>Customer 360</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Ledger Usage Stream */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 bg-black border-b border-zinc-800">
          <h3 className="text-xs font-bold text-white uppercase font-mono">Recent Telephony Call Debits</h3>
          <p className="text-[11px] text-zinc-400">Live append-only audit stream of call_usage ledger debits.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-black text-[11px] uppercase tracking-wider text-zinc-400 font-mono border-b border-zinc-800">
              <tr>
                <th className="px-5 py-3 font-semibold">Timestamp</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Debit Delta</th>
                <th className="px-4 py-3 font-semibold">Remaining Balance</th>
                <th className="px-4 py-3 font-semibold">Idempotency Key / Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-zinc-500">
                    Loading recent debits...
                  </td>
                </tr>
              ) : (!data?.recentActivity || data.recentActivity.length === 0) ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-zinc-500">
                    No recent call debits recorded in the ledger.
                  </td>
                </tr>
              ) : (
                data.recentActivity.map((t: any) => {
                  const debitMins = (Math.abs(t.deltaSeconds) / 60).toFixed(1);
                  return (
                    <tr key={t.id} className="hover:bg-zinc-900/40 font-mono">
                      <td className="px-5 py-3 text-zinc-400 text-[11px]">
                        {new Date(t.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-sans">
                        <button
                          type="button"
                          onClick={() => t.userId && onSelectCustomer?.(t.userId)}
                          className="text-white hover:underline cursor-pointer text-left font-medium block"
                        >
                          {t.user?.fullName || t.user?.email || t.userId}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-red-400 bg-red-950/60 px-2 py-0.5 rounded font-bold">
                          -{debitMins} min ({Math.abs(t.deltaSeconds)}s)
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white font-semibold">
                        {(t.balanceAfterSeconds / 60).toFixed(1)} min
                      </td>
                      <td className="px-4 py-3 text-[10px] text-zinc-500 truncate max-w-xs">
                        {t.idempotencyKey || t.refId || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
