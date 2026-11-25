import React, { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { fmtDateTime, tierLabel } from '../lib/format';
import { ErrorNote, SuccessNote, secondaryBtn } from '../components/Dialog';

interface KycRow {
  id: string;
  email: string;
  fullName: string;
  accountType: string;
  planExpiresAt: string | null;
  /** The same summary the customer's own KYC page shows (server utils/kycStatus.kycSummary). */
  carrierKyc: { status: string; callsBlocked: boolean; source: 'own' | 'company'; mode: string; businessType: string; verifiedAt: string | null; checkedAt: string | null; verifications: Record<string, string> | null; simulated: boolean } | null;
  businessKyc: { status: string; businessName: string; rejectionReason: string | null; updatedAt: string } | null;
  documents: Array<{ documentType: string; status: string; failureReason: string | null; updatedAt: string }>;
  numbersWaitingOnKyc: number;
  numbersTotal: number;
}
interface Summary { byStatus: Record<string, number>; callsBlocked: number; notStarted: number }

const FILTERS: Array<[string, string]> = [
  ['pending', 'Waiting for the carrier'],
  ['failed', 'Rejected'],
  ['blocked', 'Calls blocked'],
  ['not_started', 'Paid, KYC not started'],
  ['verified', 'Verified'],
  ['all', 'All with KYC'],
];

const badge = (status: string) =>
  status === 'verified' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
    : status === 'failed' ? 'bg-red-950/60 text-red-300 border-red-800/60'
      : 'bg-amber-950/60 text-amber-300 border-amber-800/60';

/**
 * Every customer's KYC at a glance. The carrier decides approval; this page shows the result and
 * can ask the carrier again right now. There is deliberately no "approve" button.
 */
export const KycList: React.FC<{ onSelectCustomer?: (id: string) => void }> = ({ onSelectCustomer }) => {
  const { hasPermission } = useAuth();
  const canRecheck = hasPermission('kyc:recheck');
  const [status, setStatus] = useState('pending');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<KycRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ status, page: String(page), limit: '25' });
      if (q.trim()) params.set('q', q.trim());
      const res = await adminFetch<{ data: KycRow[]; summary: Summary; pagination: { totalPages: number } }>(`/api/v2/admin/kyc?${params.toString()}`);
      setRows(res.data || []);
      setSummary(res.summary || null);
      setTotalPages(res.pagination?.totalPages || 1);
    } catch (err: any) {
      setError(err?.message || 'Could not load KYC');
    } finally {
      setLoading(false);
    }
  }, [status, page, q]);

  useEffect(() => { load(); }, [status, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const recheck = async (row: KycRow) => {
    setChecking(row.id);
    setError(null);
    setNotice(null);
    try {
      const res = await adminFetch<{ data: { before: string; after: string; changed: boolean; callsBlocked: boolean } }>(`/api/v2/admin/customers/${row.id}/kyc/recheck`, { method: 'POST', body: JSON.stringify({}) });
      const d = res.data;
      setNotice(d.changed
        ? `${row.email}: carrier now says "${d.after}" (was "${d.before}"). ${d.after === 'verified' ? 'Calls are unblocked and the customer was told.' : d.after === 'failed' ? 'The customer was told to resubmit.' : ''}`
        : `${row.email}: no change from the carrier (still "${d.after}").`);
      load();
    } catch (err: any) {
      setError(err?.message || 'Re-check failed');
    } finally {
      setChecking(null);
    }
  };

  const count = (key: string) => key === 'blocked' ? summary?.callsBlocked : key === 'not_started' ? summary?.notStarted : key === 'all' ? undefined : summary?.byStatus?.[key];

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <BadgeCheck className="h-5 w-5" />
          <span>KYC</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-1">The carrier verifies each customer's own KYC; the server picks up results every 5 minutes (and instantly when the carrier notifies us). Approval cannot be given by hand here. "Re-check now" asks the carrier at once.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setStatus(key); setPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs border cursor-pointer ${status === key ? 'bg-white text-black border-white font-semibold' : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-600'}`}
          >
            {label}{count(key) !== undefined ? ` (${count(key)})` : ''}
          </button>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }} className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="h-3.5 w-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email, name or customer ID" className="w-full pl-8 pr-3 py-2 bg-black border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500" />
        </div>
        <button type="submit" className={secondaryBtn}>Search</button>
      </form>

      <SuccessNote message={notice} />
      <ErrorNote message={error} />

      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300 min-w-[900px]">
            <thead className="text-[11px] uppercase tracking-wider text-zinc-400 font-mono border-b border-zinc-800">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Carrier KYC</th>
                <th className="px-4 py-3">Documents</th>
                <th className="px-4 py-3">Business KYC</th>
                <th className="px-4 py-3">Numbers</th>
                <th className="px-4 py-3">Last checked</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-zinc-500">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-zinc-500">No customers in this list.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-900/40 align-top">
                  <td className="px-4 py-3 min-w-0">
                    <button type="button" onClick={() => onSelectCustomer?.(r.id)} className="text-white font-medium hover:underline text-left break-all">{r.fullName || r.email}</button>
                    <div className="text-[11px] text-zinc-500 font-mono break-all">{r.email}</div>
                    <div className="text-[10px] text-zinc-500">{tierLabel(r.accountType)}</div>
                  </td>
                  <td className="px-4 py-3">
                    {r.carrierKyc ? (
                      <div className="space-y-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-semibold border ${badge(r.carrierKyc.status)}`}>{r.carrierKyc.status}</span>
                        {r.carrierKyc.callsBlocked && <div className="text-[10px] text-red-300">Calls blocked</div>}
                        {r.carrierKyc.source === 'company' && <div className="text-[10px] text-zinc-400">Company KYC (platform account)</div>}
                        {r.carrierKyc.source === 'own' && r.carrierKyc.mode !== 'customer_use' && <div className="text-[10px] text-amber-300">Own KYC not set up yet ({r.carrierKyc.mode})</div>}
                        {r.carrierKyc.verifications && r.carrierKyc.source === 'own' && (
                          <div className="text-[10px] text-zinc-500">{Object.entries(r.carrierKyc.verifications).filter(([, v]) => v !== 'not_started').map(([k, v]) => `${k.toUpperCase()} ${v}`).join(' · ') || 'No documents at the carrier yet'}</div>
                        )}
                        {r.carrierKyc.simulated && <div className="text-[10px] text-zinc-500">Simulated (test)</div>}
                        {r.carrierKyc.verifiedAt && <div className="text-[10px] text-zinc-500">Verified {fmtDateTime(r.carrierKyc.verifiedAt)}</div>}
                      </div>
                    ) : <span className="text-zinc-500">Not started</span>}
                  </td>
                  <td className="px-4 py-3">
                    {r.documents.length === 0 ? <span className="text-zinc-500">None</span> : (
                      <div className="space-y-1">
                        {r.documents.map((d, i) => (
                          <div key={i} className="text-[11px]">
                            <span className="uppercase font-mono text-zinc-200">{d.documentType}</span>{' '}
                            <span className={d.status === 'verified' ? 'text-emerald-400' : d.status === 'failed' ? 'text-red-300' : 'text-amber-300'}>{d.status}</span>
                            {d.failureReason && <div className="text-[10px] text-red-300/80 break-words">{d.failureReason}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.businessKyc ? (
                      <div className="text-[11px]">
                        <div className="text-zinc-200 break-words">{r.businessKyc.businessName}</div>
                        <div className={r.businessKyc.status === 'accepted' ? 'text-emerald-400' : r.businessKyc.status === 'rejected' ? 'text-red-300' : 'text-amber-300'}>{r.businessKyc.status}</div>
                        {r.businessKyc.rejectionReason && <div className="text-[10px] text-red-300/80 break-words">{r.businessKyc.rejectionReason}</div>}
                      </div>
                    ) : <span className="text-zinc-500">—</span>}
                  </td>
                  <td className="px-4 py-3 text-[11px]">
                    {r.numbersTotal === 0 ? <span className="text-zinc-500">None</span> : (
                      <span>{r.numbersTotal}{r.numbersWaitingOnKyc > 0 && <span className="text-amber-300"> ({r.numbersWaitingOnKyc} waiting on KYC)</span>}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[11px] font-mono text-zinc-400">{r.carrierKyc?.checkedAt ? fmtDateTime(r.carrierKyc.checkedAt) : r.carrierKyc ? 'Not yet' : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {canRecheck && r.carrierKyc && !r.carrierKyc.simulated && (
                      <button type="button" onClick={() => recheck(r)} disabled={checking !== null} className={secondaryBtn + ' inline-flex items-center gap-1.5'}>
                        <RefreshCw className={`h-3.5 w-3.5 ${checking === r.id ? 'animate-spin' : ''}`} />
                        {checking === r.id ? 'Checking…' : 'Re-check now'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button aria-label="Previous page" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 disabled:opacity-40 cursor-pointer"><ChevronLeft className="h-4 w-4" /></button>
            <button aria-label="Next page" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 disabled:opacity-40 cursor-pointer"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
};
