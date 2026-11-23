import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { adminFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { fmtDateTime, inr } from '../lib/format';
import { Dialog, ErrorNote, ReasonField, reasonOk, fieldClass, labelClass, primaryBtn, secondaryBtn } from './Dialog';
import { RefundDialog, RefundTarget } from './RefundDialog';

interface Issue {
  id: string;
  createdAt: string;
  reason: string;
  source: string | null;
  amountInr: number | null;
  paymentId: string | null;
  orderId: string | null;
  customer: { id: string; email?: string; fullName?: string; contactNumber?: string | null } | null;
  payment: { id: string; paymentId: string; status: string; amount: number; planName: string } | null;
}

/**
 * Payments where the customer paid but did not get what they paid for. Nothing is refunded by the
 * system (owner rule): the owner refunds with one click here, or closes the case without a refund.
 */
export const PaymentIssues: React.FC<{ onSelectCustomer?: (id: string) => void; onChanged?: () => void }> = ({ onSelectCustomer, onChanged }) => {
  const { hasPermission } = useAuth();
  const canDecide = hasPermission('refunds:manage');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refundTarget, setRefundTarget] = useState<RefundTarget | null>(null);
  const [closeTarget, setCloseTarget] = useState<Issue | null>(null);
  const [outcome, setOutcome] = useState('number_set_up');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await adminFetch<{ data: Issue[] }>('/api/v2/admin/payment-issues');
      setIssues(res.data || []);
    } catch (err: any) {
      setError(err?.message || 'Could not load payments waiting for a decision');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const closeCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closeTarget || !reasonOk(reason)) return;
    setBusy(true);
    setCloseError(null);
    try {
      await adminFetch(`/api/v2/admin/payment-issues/${closeTarget.id}/close`, { method: 'POST', body: JSON.stringify({ outcome, reason: reason.trim() }) });
      setNotice('Case closed without a refund.');
      setCloseTarget(null);
      load();
    } catch (err: any) {
      setCloseError(err?.message || 'Could not close the case');
    } finally {
      setBusy(false);
    }
  };

  if (!issues.length && !error) {
    return notice ? (
      <div role="status" className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 shrink-0" /> {notice} No payments are waiting for a decision.
      </div>
    ) : null;
  }

  return (
    <section className="bg-amber-950/20 border border-amber-700/50 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-amber-800/40">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <span>Waiting for your decision ({issues.length})</span>
        </h2>
        <p className="text-[11px] text-amber-200/80 mt-1">These customers paid but did not get what they paid for. Nothing is refunded automatically. Refund sends the money back through Razorpay and tells the customer; Close keeps the payment (for example after you set the number up by hand).</p>
      </div>
      <ErrorNote message={error} />
      {notice && <p className="px-4 pt-3 text-xs text-emerald-300">{notice}</p>}
      <div className="divide-y divide-amber-900/40">
        {issues.map((i) => {
          const refundable = i.payment && (i.payment.status === 'completed' || i.payment.status === 'paid');
          return (
            <div key={i.id} className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs min-w-0">
              <div className="min-w-0 space-y-1">
                <p className="text-white font-semibold">
                  {inr(i.amountInr ?? i.payment?.amount)} ·{' '}
                  <button type="button" className="underline hover:text-amber-200 cursor-pointer" onClick={() => i.customer?.id && onSelectCustomer?.(i.customer.id)}>
                    {i.customer?.fullName || i.customer?.email || 'Customer'}
                  </button>
                  <span className="text-zinc-400 font-normal"> {i.customer?.email} {i.customer?.contactNumber || ''}</span>
                </p>
                <p className="text-amber-200 break-words">{i.reason}</p>
                <p className="text-[10px] text-zinc-500 font-mono break-all">{fmtDateTime(i.createdAt)} · payment {i.paymentId} · {i.payment ? i.payment.status : 'not on record'}</p>
              </div>
              {canDecide && (
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={!refundable}
                    title={refundable ? 'Refund the full amount through Razorpay' : 'This payment is not in a refundable state'}
                    onClick={() => i.payment && setRefundTarget({ id: i.payment.id, amount: Number(i.payment.amount), planName: i.payment.planName, paymentId: i.payment.paymentId })}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Refund
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCloseTarget(i); setOutcome('number_set_up'); setReason(''); setCloseError(null); }}
                    className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-lg cursor-pointer"
                  >
                    Close without refund
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <RefundDialog
        target={refundTarget}
        onClose={() => setRefundTarget(null)}
        onDone={(msg) => { setRefundTarget(null); setNotice(`${msg} The customer was notified and the case is closed.`); load(); onChanged?.(); }}
      />

      <Dialog open={closeTarget !== null} onClose={() => { if (!busy) setCloseTarget(null); }} title="Close this case without a refund?" description="The customer keeps their payment on record and is not refunded. Use this after you set the number up by hand or agreed something else with the customer.">
        <ErrorNote message={closeError} />
        <form onSubmit={closeCase} className="space-y-4">
          <div>
            <label className={labelClass}>What happened</label>
            <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className={fieldClass}>
              <option value="number_set_up">Number set up by hand</option>
              <option value="no_refund">No refund (agreed with the customer)</option>
              <option value="other">Other (explain below)</option>
            </select>
          </div>
          <ReasonField value={reason} onChange={setReason} />
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryBtn} onClick={() => setCloseTarget(null)} disabled={busy}>Cancel</button>
            <button type="submit" className={primaryBtn} disabled={busy || !reasonOk(reason)}>{busy ? 'Closing…' : 'Close case'}</button>
          </div>
        </form>
      </Dialog>
    </section>
  );
};
