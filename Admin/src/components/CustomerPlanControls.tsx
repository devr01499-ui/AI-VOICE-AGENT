import React, { useEffect, useMemo, useState } from 'react';
import { Gift, CalendarPlus, Link as LinkIcon, Copy, Check } from 'lucide-react';
import { adminFetch, newRequestKey } from '../lib/api';
import { inr, tierLabel, fmtDate } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { Dialog, ErrorNote, SuccessNote, ReasonField, reasonOk, fieldClass, labelClass, primaryBtn, secondaryBtn } from './Dialog';

interface PlanOption {
  key: string;
  name: string;
  priceInr: number;
  minutes: number;
  accountType: string;
  custom: boolean;
  validityDays?: number | null;
  forCustomer?: string | null;
  purchasable?: boolean;
}

type Mode = 'assign' | 'extend' | 'link' | null;

/**
 * Plan actions on one customer: give a plan without payment, extend the current plan, or send a
 * real Razorpay payment link for a plan (price and minutes always come from the server).
 */
export const CustomerPlanControls: React.FC<{ customerId: string; planExpiresAt?: string | null; onChanged: () => void }> = ({ customerId, planExpiresAt, onChanged }) => {
  const { hasPermission } = useAuth();
  const canAssign = hasPermission('plans:assign');
  const canLink = hasPermission('payment_links:create');
  const [mode, setMode] = useState<Mode>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [planKey, setPlanKey] = useState('');
  const [creditMinutes, setCreditMinutes] = useState(true);
  const [validityDays, setValidityDays] = useState('');
  const [days, setDays] = useState(7);
  const [discount, setDiscount] = useState(0);
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [reason, setReason] = useState('');
  const [requestKey, setRequestKey] = useState(newRequestKey());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!mode || mode === 'extend' || plans.length) return;
    adminFetch<{ success: boolean; data: any[]; builtIn: any[] }>('/api/v2/admin/plans')
      .then((res) => {
        const builtIn: PlanOption[] = (res.builtIn || []).map((p) => ({ ...p, custom: false }));
        const custom: PlanOption[] = (res.data || [])
          .filter((p) => p.active && (!p.customerUserId || p.customerUserId === customerId))
          .map((p) => ({ key: p.key, name: p.name, priceInr: p.priceInr, minutes: p.minutes, accountType: p.accountType, custom: true, validityDays: p.validityDays, forCustomer: p.customerUserId }));
        setPlans([...builtIn, ...custom]);
      })
      .catch((err) => setError(err?.message || 'Could not load plans'));
  }, [mode, plans.length, customerId]);

  const selected = useMemo(() => plans.find((p) => p.key === planKey) || null, [plans, planKey]);
  const linkAmount = selected ? Math.max(1, Math.round(selected.priceInr * (1 - (Number(discount) || 0) / 100))) : 0;

  const open = (m: Mode) => {
    setMode(m);
    setError(null);
    setDone(null);
    setLinkUrl(null);
    setReason('');
    setRequestKey(newRequestKey());
  };
  const close = () => { if (!busy) setMode(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonOk(reason)) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'assign') {
        await adminFetch(`/api/v2/admin/customers/${customerId}/plan/assign`, {
          method: 'POST',
          body: JSON.stringify({ planKey, creditMinutes, validityDays: validityDays ? Number(validityDays) : undefined, reason: reason.trim(), idempotencyKey: requestKey }),
        });
        setDone(`${selected?.name} activated${creditMinutes ? ` with ${selected?.minutes.toLocaleString('en-IN')} minutes` : ''}.`);
        onChanged();
      } else if (mode === 'extend') {
        const res = await adminFetch<{ data: { planExpiresAt?: string } }>(`/api/v2/admin/customers/${customerId}/plan/extend`, {
          method: 'POST',
          body: JSON.stringify({ days: Number(days), reason: reason.trim(), idempotencyKey: requestKey }),
        });
        setDone(`Plan now ends on ${fmtDate(res.data?.planExpiresAt)}.`);
        onChanged();
      } else if (mode === 'link') {
        const res = await adminFetch<{ data: { shortUrl?: string; amountInr: number; testMode?: boolean } }>('/api/v2/admin/payments/create-link', {
          method: 'POST',
          body: JSON.stringify({ customerUserId: customerId, planKey, discountPercent: Number(discount) || 0, expiresInDays: Number(expiresInDays), reason: reason.trim() }),
        });
        if (res.data?.testMode) {
          setDone(`Test mode (no payment gateway keys on this server): a test link record for ${inr(res.data.amountInr)} was saved, but no real link exists.`);
        } else {
          setLinkUrl(res.data?.shortUrl || null);
          setDone(`Payment link for ${inr(res.data?.amountInr)} created. Razorpay also emailed it to the customer.`);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'The action failed');
    } finally {
      setBusy(false);
    }
  };

  if (!canAssign && !canLink) return null;

  const planSelect = (
    <div>
      <label className={labelClass}>Plan</label>
      <select value={planKey} onChange={(e) => setPlanKey(e.target.value)} required className={fieldClass}>
        <option value="">Choose a plan…</option>
        {plans.map((p) => (
          <option key={p.key} value={p.key}>
            {p.name} — {inr(p.priceInr)} · {p.minutes.toLocaleString('en-IN')} min · {tierLabel(p.accountType)} features{p.custom ? (p.forCustomer ? ' (custom, this customer)' : ' (custom)') : ''}{p.purchasable === false ? ' (not on sale)' : ''}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canAssign && (
          <button type="button" onClick={() => open('assign')} className={secondaryBtn + ' flex items-center gap-1.5'}>
            <Gift className="h-3.5 w-3.5" /> Assign plan
          </button>
        )}
        {canAssign && (
          <button type="button" onClick={() => open('extend')} className={secondaryBtn + ' flex items-center gap-1.5'}>
            <CalendarPlus className="h-3.5 w-3.5" /> Extend plan
          </button>
        )}
        {canLink && (
          <button type="button" onClick={() => open('link')} className={secondaryBtn + ' flex items-center gap-1.5'}>
            <LinkIcon className="h-3.5 w-3.5" /> Payment link
          </button>
        )}
      </div>

      <Dialog
        open={mode !== null}
        onClose={close}
        title={mode === 'assign' ? 'Assign a plan (no payment)' : mode === 'extend' ? 'Extend plan validity' : 'Send a payment link'}
        description={
          mode === 'assign' ? 'Sets the plan features and a new end date now. Minutes are added through the ledger and count against your role cap.'
            : mode === 'extend' ? `Current end: ${planExpiresAt ? fmtDate(planExpiresAt) : 'no end date'}. Days are added to the later of today and the current end.`
              : 'A real Razorpay link. The customer pays the plan price minus your discount; the minutes are credited automatically when the payment arrives.'
        }
      >
        <ErrorNote message={error} />
        <SuccessNote message={done} />
        {linkUrl && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-black border border-zinc-800">
            <code className="text-xs text-white break-all flex-1">{linkUrl}</code>
            <button type="button" className={secondaryBtn} onClick={() => { navigator.clipboard.writeText(linkUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
        {!done && (
          <form onSubmit={submit} className="space-y-4">
            {mode === 'assign' && (
              <>
                {planSelect}
                <div>
                  <label className={labelClass}>Validity (days, optional)</label>
                  <input type="number" min={1} max={365} value={validityDays} onChange={(e) => setValidityDays(e.target.value)} placeholder={selected?.validityDays ? String(selected.validityDays) : '30 (default)'} className={fieldClass} />
                </div>
                <label className="flex items-start gap-2 text-xs text-zinc-300">
                  <input type="checkbox" checked={creditMinutes} onChange={(e) => setCreditMinutes(e.target.checked)} className="mt-0.5" />
                  <span>Add the plan's minutes{selected ? ` (${selected.minutes.toLocaleString('en-IN')})` : ''} to the balance</span>
                </label>
              </>
            )}
            {mode === 'extend' && (
              <div>
                <label className={labelClass}>Days to add</label>
                <input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} required className={fieldClass} />
              </div>
            )}
            {mode === 'link' && (
              <>
                {planSelect}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Discount %</label>
                    <input type="number" min={0} max={100} step={1} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className={fieldClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Link expires (days)</label>
                    <input type="number" min={1} max={30} value={expiresInDays} onChange={(e) => setExpiresInDays(Number(e.target.value))} className={fieldClass} />
                  </div>
                </div>
                {selected && (
                  <p className="text-xs text-zinc-300">Customer pays <span className="font-bold text-white">{inr(linkAmount)}</span> for {selected.minutes.toLocaleString('en-IN')} minutes.</p>
                )}
              </>
            )}
            <ReasonField value={reason} onChange={setReason} />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={close} className={secondaryBtn} disabled={busy}>Cancel</button>
              <button type="submit" className={primaryBtn} disabled={busy || !reasonOk(reason) || (mode !== 'extend' && !planKey)}>
                {busy ? 'Working…' : mode === 'assign' ? 'Assign plan' : mode === 'extend' ? 'Extend' : 'Create link'}
              </button>
            </div>
          </form>
        )}
        {done && (
          <div className="flex justify-end"><button type="button" onClick={close} className={primaryBtn}>Close</button></div>
        )}
      </Dialog>
    </>
  );
};
