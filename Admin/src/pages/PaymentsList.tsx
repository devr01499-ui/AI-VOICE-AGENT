import React, { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { fmtDateTime, inr } from '../lib/format';
import { ErrorNote, SuccessNote } from '../components/Dialog';
import { RefundDialog, RefundTarget } from '../components/RefundDialog';
import { PaymentIssues } from '../components/PaymentIssues';
import { CreditCard, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

interface PaymentsListProps {
  onSelectCustomer?: (customerId: string) => void;
}

const STATUS_FILTERS: Array<[string, string]> = [
  ['all', 'All statuses'],
  ['completed', 'Completed'],
  ['refund_pending', 'Refund in progress'],
  ['refunded', 'Refunded'],
];

const statusClass = (s: string) =>
  s === 'completed' || s === 'paid'
    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
    : s === 'refunded'
      ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20';

export const PaymentsList: React.FC<PaymentsListProps> = ({ onSelectCustomer }) => {
  const { hasPermission } = useAuth();
  const canRefund = hasPermission('refunds:manage');
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [refundTarget, setRefundTarget] = useState<RefundTarget | null>(null);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminFetch<{
        success: boolean;
        data: any[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`/api/v2/admin/payments?page=${page}&limit=25&status=${encodeURIComponent(status)}`);
      setPayments(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalCount(res.pagination?.total || 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-white" />
            <span>Payments & GST Invoices</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Razorpay payments for plans and numbers, with their invoices ({totalCount} shown by this filter). Times in IST.</p>
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 bg-black border border-zinc-800 rounded-xl text-xs text-white self-start">
          {STATUS_FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <SuccessNote message={notice} />
      <ErrorNote message={error} />

      <PaymentIssues onSelectCustomer={onSelectCustomer} onChanged={fetchPayments} />

      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 min-w-[860px]">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Payment / Order ID</th>
                <th className="px-4 py-3.5 font-semibold">Customer</th>
                <th className="px-4 py-3.5 font-semibold">Plan</th>
                <th className="px-4 py-3.5 font-semibold">Amount</th>
                <th className="px-4 py-3.5 font-semibold">Status</th>
                <th className="px-4 py-3.5 font-semibold">GST Invoice</th>
                <th className="px-4 py-3.5 font-semibold">Date</th>
                {canRefund && <th className="px-4 py-3.5 font-semibold text-right">Refund</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading payment transactions...</span>
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">No payments match this filter.</td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-mono text-white text-[11px] break-all">{p.paymentId}</div>
                      <div className="font-mono text-slate-500 text-[10px] mt-0.5 break-all">{p.orderId}</div>
                      {p.source && <div className="font-mono text-slate-500 text-[10px] uppercase">{p.source}</div>}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => p.userId && onSelectCustomer?.(p.userId)}
                        className={`text-left text-white font-medium block ${onSelectCustomer && p.userId ? 'cursor-pointer hover:underline' : ''}`}
                      >
                        {p.user?.fullName || 'User'}
                      </button>
                      <div className="text-[11px] text-slate-400 font-mono break-all">{p.user?.email}</div>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-200">{p.planName === 'phone_number' ? 'Phone number' : p.planName}</td>
                    <td className="px-4 py-3.5 font-mono text-white font-bold">{inr(p.amount)}</td>
                    <td className="px-4 py-3.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase font-semibold ${statusClass(p.status)}`}>{String(p.status).split('_').join(' ')}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      {p.invoice ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-zinc-300">{p.invoice.invoiceNumber}</span>
                          {p.invoice.pdfUrl && (
                            <a href={p.invoice.pdfUrl} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white" aria-label="Open invoice PDF">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-600 font-mono">No invoice</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-400">{fmtDateTime(p.createdAt)}</td>
                    {canRefund && (
                      <td className="px-4 py-3.5 text-right">
                        {(p.status === 'completed' || p.status === 'paid') && p.paymentId && Number(p.amount) > 0 ? (
                          <button
                            className="text-[11px] text-red-300 hover:text-white underline cursor-pointer"
                            onClick={() => setRefundTarget({ id: p.id, amount: Number(p.amount), planName: p.planName, paymentId: p.paymentId })}
                          >
                            Refund
                          </button>
                        ) : <span className="text-[10px] text-zinc-600">—</span>}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong>
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((x) => Math.max(1, x - 1))} disabled={page <= 1} aria-label="Previous page" className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setPage((x) => Math.min(totalPages, x + 1))} disabled={page >= totalPages} aria-label="Next page" className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <RefundDialog
        target={refundTarget}
        onClose={() => setRefundTarget(null)}
        onDone={(msg) => { setRefundTarget(null); setNotice(msg); fetchPayments(); }}
      />
    </div>
  );
};
