import React, { useState } from 'react';
import { adminFetch } from '../lib/api';
import { inr } from '../lib/format';
import { Dialog, ErrorNote, ReasonField, reasonOk, dangerBtn, secondaryBtn } from './Dialog';

export interface RefundTarget {
  id: string;
  amount: number;
  planName: string;
  paymentId?: string | null;
}

/**
 * Full refund through Razorpay. The server refunds first and only records "refunded" when Razorpay
 * accepted it; the minutes that purchase added are taken back (never below zero).
 */
export const RefundDialog: React.FC<{ target: RefundTarget | null; onClose: () => void; onDone: (msg: string) => void }> = ({ target, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  const [endPlan, setEndPlan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) return;
    setReason('');
    setEndPlan(false);
    setError(null);
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target || !reasonOk(reason)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await adminFetch<{ success: boolean; data: { refundId?: string; minutesRemoved?: number } }>(`/api/v2/admin/payments/${target.id}/refund`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim(), endPlan }),
      });
      const d = res.data || {};
      setReason('');
      setEndPlan(false);
      onDone(`Refunded ${inr(target.amount)} (Razorpay refund ${d.refundId || 'issued'}). ${d.minutesRemoved ? `${d.minutesRemoved} minutes taken back.` : 'No minutes to take back.'}`);
    } catch (err: any) {
      setError(err?.message || 'Refund failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={Boolean(target)} onClose={close} title={`Refund ${target ? inr(target.amount) : ''}`} description="Full refund to the customer's original payment method through Razorpay. This cannot be undone.">
      <ErrorNote message={error} />
      <form onSubmit={submit} className="space-y-4">
        <div className="p-3 rounded-xl bg-black border border-zinc-800 text-xs text-zinc-300 space-y-1">
          <div className="flex justify-between gap-3"><span className="text-zinc-500">Plan</span><span className="font-mono text-white break-all text-right">{target?.planName}</span></div>
          <div className="flex justify-between gap-3"><span className="text-zinc-500">Payment</span><span className="font-mono break-all text-right">{target?.paymentId || '—'}</span></div>
        </div>
        <label className="flex items-start gap-2 text-xs text-zinc-300">
          <input type="checkbox" checked={endPlan} onChange={(e) => setEndPlan(e.target.checked)} className="mt-0.5" />
          <span>Also end the customer's plan now (their number is released after the usual grace period unless they buy again).</span>
        </label>
        <ReasonField value={reason} onChange={setReason} placeholder="e.g. Customer asked for a refund within 7 days" />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={close} className={secondaryBtn} disabled={busy}>Cancel</button>
          <button type="submit" className={dangerBtn} disabled={busy || !reasonOk(reason)}>{busy ? 'Refunding…' : 'Refund now'}</button>
        </div>
      </form>
    </Dialog>
  );
};
