import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CreditCard, Plus, Download, Link as LinkIcon, Copy, Check, AlertTriangle } from 'lucide-react';
import { adminFetch, adminDownload } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { fmtDate, fmtDateTime, inr, tierLabel } from '../lib/format';
import { Dialog, ErrorNote, SuccessNote, ReasonField, reasonOk, fieldClass, labelClass, primaryBtn, secondaryBtn } from '../components/Dialog';

interface BuiltInPlan { key: string; name: string; priceInr: number; minutes: number; accountType: string; maxConcurrentCalls: number; purchasable: boolean }
interface CustomPlan { id: string; key: string; name: string; priceInr: number; minutes: number; accountType: string; customerUserId: string | null; validityDays: number | null; active: boolean; createdBy: string | null; createdAt: string }
interface PaymentLinkRow { id: string; userId: string; planKey: string | null; amountInr: number; minutes: number; status: string; razorpayLinkId: string; shortUrl: string | null; expiresAt: string | null; createdAt: string }

/** Tiers a custom plan can give (same as PLAN_ACCOUNT_TYPES on the server). */
const TIERS = ['starter', 'developer', 'professional', 'enterprise'];

export const PlansList: React.FC = () => {
  const { hasPermission } = useAuth();
  const [builtIn, setBuiltIn] = useState<BuiltInPlan[]>([]);
  const [custom, setCustom] = useState<CustomPlan[]>([]);
  const [links, setLinks] = useState<PaymentLinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', key: '', priceInr: 5000, minutes: 1500, accountType: 'professional', customerUserId: '', validityDays: 30, reason: '' });
  const [toggleTarget, setToggleTarget] = useState<CustomPlan | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PaymentLinkRow | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [plans, linkRes] = await Promise.all([
        adminFetch<{ success: boolean; data: CustomPlan[]; builtIn: BuiltInPlan[] }>('/api/v2/admin/plans'),
        hasPermission('payments:view')
          ? adminFetch<{ success: boolean; data: PaymentLinkRow[] }>('/api/v2/admin/payment-links')
          : Promise.resolve({ success: true, data: [] as PaymentLinkRow[] }),
      ]);
      setBuiltIn(plans.builtIn || []);
      setCustom(plans.data || []);
      setLinks(linkRes.data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, [hasPermission]);

  useEffect(() => { load(); }, [load]);

  // Same formula as the server (computedDiscountPercent): price per minute vs the list price per
  // minute of the built-in plan with the same features. Shown for guidance; the server decides.
  const estimatedDiscount = useMemo(() => {
    const tier = builtIn.find((p) => p.accountType === form.accountType && p.minutes > 0);
    const list = tier ? tier.priceInr / tier.minutes : 0;
    if (!list || !form.minutes) return 0;
    return Math.max(0, Math.round((1 - (form.priceInr / form.minutes) / list) * 1000) / 10);
  }, [builtIn, form.accountType, form.priceInr, form.minutes]);

  const createPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonOk(form.reason)) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await adminFetch<{ data: { discountPercent: number; name: string } }>('/api/v2/admin/plans/custom', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          key: form.key.trim() || undefined,
          priceInr: Number(form.priceInr),
          minutes: Number(form.minutes),
          accountType: form.accountType,
          customerUserId: form.customerUserId.trim() || undefined,
          validityDays: Number(form.validityDays) || undefined,
          reason: form.reason.trim(),
        }),
      });
      setCreateOpen(false);
      setForm({ name: '', key: '', priceInr: 5000, minutes: 1500, accountType: 'professional', customerUserId: '', validityDays: 30, reason: '' });
      setNotice(`Custom plan "${res.data.name}" created (${res.data.discountPercent}% below list price). Send it with a payment link from the customer's page.`);
      load();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to create the plan');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toggleTarget || !reasonOk(reason)) return;
    setBusy(true);
    setActionError(null);
    try {
      await adminFetch(`/api/v2/admin/plans/${toggleTarget.id}`, { method: 'PATCH', body: JSON.stringify({ active: !toggleTarget.active, reason: reason.trim() }) });
      setNotice(`"${toggleTarget.name}" is now ${toggleTarget.active ? 'off' : 'on'}.`);
      setToggleTarget(null);
      load();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update the plan');
    } finally {
      setBusy(false);
    }
  };

  const cancelLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget || !reasonOk(reason)) return;
    setBusy(true);
    setActionError(null);
    try {
      await adminFetch(`/api/v2/admin/payment-links/${cancelTarget.id}/cancel`, { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) });
      setNotice('Payment link cancelled at Razorpay.');
      setCancelTarget(null);
      load();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to cancel the link');
    } finally {
      setBusy(false);
    }
  };

  const doExport = async (type: 'customers' | 'calls' | 'payments') => {
    setExporting(type);
    setError(null);
    try {
      await adminDownload(`/api/v2/admin/exports/${type}`, `claritiy_${type}.csv`);
    } catch (err: any) {
      setError(err?.message || 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const linkStatus = (l: PaymentLinkRow) => (l.status === 'created' && l.expiresAt && new Date(l.expiresAt).getTime() < Date.now() ? 'expired' : l.status);

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            <span>Plans & Payment Links</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Standard plans are edited in the Control Panel. Here: private deals for single customers and the payment links sent for them.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPermission('exports:csv') && (['customers', 'calls', 'payments'] as const).map((t) => (
            <button key={t} onClick={() => doExport(t)} disabled={exporting !== null} className={secondaryBtn + ' flex items-center gap-1.5 capitalize'}>
              <Download className="h-3.5 w-3.5" /> {exporting === t ? 'Exporting…' : `${t} CSV`}
            </button>
          ))}
          <button onClick={() => { setCreateOpen(true); setActionError(null); }} className={primaryBtn + ' flex items-center gap-1.5'}>
            <Plus className="h-3.5 w-3.5" /> New custom plan
          </button>
        </div>
      </div>

      <SuccessNote message={notice} />
      <ErrorNote message={error} />

      {loading ? (
        <div className="py-16 text-center text-zinc-500 text-sm">Loading plans…</div>
      ) : (
        <>
          <section className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800">
              <h2 className="text-xs font-bold text-white uppercase font-mono">Standard plans (live prices)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300 min-w-[640px]">
                <thead className="text-[11px] uppercase tracking-wider text-zinc-400 font-mono border-b border-zinc-800">
                  <tr><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Minutes</th><th className="px-4 py-3">Calls at once</th><th className="px-4 py-3">Features</th><th className="px-4 py-3">On sale</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {builtIn.map((p) => (
                    <tr key={p.key}>
                      <td className="px-4 py-3 text-white font-semibold">{p.name}</td>
                      <td className="px-4 py-3 font-mono">{inr(p.priceInr)}</td>
                      <td className="px-4 py-3 font-mono">{p.minutes.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 font-mono">{p.maxConcurrentCalls}</td>
                      <td className="px-4 py-3">{tierLabel(p.accountType)}</td>
                      <td className="px-4 py-3">{p.purchasable ? 'Yes' : <span className="text-amber-300">No</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800">
              <h2 className="text-xs font-bold text-white uppercase font-mono">Custom plans</h2>
              <p className="text-[11px] text-zinc-400 mt-1">Never shown on the website. Sold only through a payment link, or given with "Assign plan" on the customer's page.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300 min-w-[760px]">
                <thead className="text-[11px] uppercase tracking-wider text-zinc-400 font-mono border-b border-zinc-800">
                  <tr><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Minutes</th><th className="px-4 py-3">Features</th><th className="px-4 py-3">Validity</th><th className="px-4 py-3">For</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {custom.length === 0 && (<tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-500">No custom plans yet.</td></tr>)}
                  {custom.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3"><div className="text-white font-semibold break-words">{p.name}</div><div className="text-[10px] font-mono text-zinc-500">{p.key} · {fmtDate(p.createdAt)}</div></td>
                      <td className="px-4 py-3 font-mono">{inr(p.priceInr)}</td>
                      <td className="px-4 py-3 font-mono">{p.minutes.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3">{tierLabel(p.accountType)}</td>
                      <td className="px-4 py-3">{p.validityDays ? `${p.validityDays} days` : '30 days'}</td>
                      <td className="px-4 py-3 font-mono text-[10px] break-all">{p.customerUserId || 'Any customer'}</td>
                      <td className="px-4 py-3">{p.active ? <span className="text-emerald-400">On</span> : <span className="text-zinc-500">Off</span>}</td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-[11px] underline text-zinc-300 hover:text-white cursor-pointer" onClick={() => { setToggleTarget(p); setReason(''); setActionError(null); }}>
                          {p.active ? 'Turn off' : 'Turn on'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {hasPermission('payments:view') && (
            <section className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800">
                <h2 className="text-xs font-bold text-white uppercase font-mono flex items-center gap-2"><LinkIcon className="h-3.5 w-3.5" /> Payment links (latest 100)</h2>
                <p className="text-[11px] text-zinc-400 mt-1">Create a link from the customer's page (Payment link button). Paid links activate the plan automatically.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-300 min-w-[760px]">
                  <thead className="text-[11px] uppercase tracking-wider text-zinc-400 font-mono border-b border-zinc-800">
                    <tr><th className="px-4 py-3">Created</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Minutes</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Link</th><th className="px-4 py-3"></th></tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {links.length === 0 && (<tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-500">No payment links yet.</td></tr>)}
                    {links.map((l) => {
                      const status = linkStatus(l);
                      return (
                        <tr key={l.id}>
                          <td className="px-4 py-3 font-mono text-[11px]">{fmtDateTime(l.createdAt)}</td>
                          <td className="px-4 py-3 font-mono text-[10px] break-all">{l.userId}</td>
                          <td className="px-4 py-3">{l.planKey}</td>
                          <td className="px-4 py-3 font-mono">{inr(l.amountInr)}</td>
                          <td className="px-4 py-3 font-mono">{Number(l.minutes).toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 capitalize">{status === 'paid' ? <span className="text-emerald-400">Paid</span> : status}</td>
                          <td className="px-4 py-3">
                            {l.shortUrl ? (
                              <button className="inline-flex items-center gap-1 text-[11px] text-zinc-300 hover:text-white cursor-pointer" onClick={() => { navigator.clipboard.writeText(l.shortUrl!); setCopiedId(l.id); setTimeout(() => setCopiedId(null), 1500); }}>
                                {copiedId === l.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy
                              </button>
                            ) : <span className="text-[10px] text-zinc-500">Test mode</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {status === 'created' && hasPermission('payment_links:create') && (
                              <button className="text-[11px] underline text-red-300 hover:text-white cursor-pointer" onClick={() => { setCancelTarget(l); setReason(''); setActionError(null); }}>Cancel</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <Dialog open={createOpen} onClose={() => { if (!busy) setCreateOpen(false); }} title="New custom plan" description="A private price for one customer (or any customer you send it to). The discount is worked out by the server and must be within your role's limit." wide>
        <ErrorNote message={actionError} />
        <form onSubmit={createPlan} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Name</label>
              <input value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Acme annual deal" required className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Key (optional)</label>
              <input value={form.key} maxLength={40} onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} placeholder="acme_annual" className={fieldClass + ' font-mono'} />
            </div>
            <div>
              <label className={labelClass}>Price (₹, whole rupees)</label>
              <input type="number" min={1} step={1} value={form.priceInr} onChange={(e) => setForm({ ...form, priceInr: Number(e.target.value) })} required className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Minutes</label>
              <input type="number" min={1} step={1} value={form.minutes} onChange={(e) => setForm({ ...form, minutes: Number(e.target.value) })} required className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Features of</label>
              <select value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value })} className={fieldClass}>
                {TIERS.map((t) => <option key={t} value={t}>{tierLabel(t)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Validity (days)</label>
              <input type="number" min={1} max={365} step={1} value={form.validityDays} onChange={(e) => setForm({ ...form, validityDays: Number(e.target.value) })} className={fieldClass} />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Only for customer ID (optional)</label>
              <input value={form.customerUserId} onChange={(e) => setForm({ ...form, customerUserId: e.target.value })} placeholder="Leave empty to allow any customer" className={fieldClass + ' font-mono'} />
            </div>
          </div>
          <p className="text-xs text-zinc-300 flex items-center gap-1.5">
            {estimatedDiscount > 30 && <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
            About <span className="font-bold text-white">{estimatedDiscount}%</span> below the {tierLabel(form.accountType)} list price per minute.
          </p>
          <ReasonField value={form.reason} onChange={(v) => setForm({ ...form, reason: v })} />
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryBtn} onClick={() => setCreateOpen(false)} disabled={busy}>Cancel</button>
            <button type="submit" className={primaryBtn} disabled={busy || !form.name.trim() || !reasonOk(form.reason)}>{busy ? 'Creating…' : 'Create plan'}</button>
          </div>
        </form>
      </Dialog>

      <Dialog open={toggleTarget !== null} onClose={() => { if (!busy) setToggleTarget(null); }} title={toggleTarget ? `${toggleTarget.active ? 'Turn off' : 'Turn on'} "${toggleTarget.name}"?` : ''} description={toggleTarget?.active ? 'It can no longer be assigned or sent in new links. Links already sent still work until they expire or are cancelled.' : 'It can be assigned and sent in links again.'}>
        <ErrorNote message={actionError} />
        <form onSubmit={toggle} className="space-y-4">
          <ReasonField value={reason} onChange={setReason} />
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryBtn} onClick={() => setToggleTarget(null)} disabled={busy}>Cancel</button>
            <button type="submit" className={primaryBtn} disabled={busy || !reasonOk(reason)}>{busy ? 'Saving…' : 'Confirm'}</button>
          </div>
        </form>
      </Dialog>

      <Dialog open={cancelTarget !== null} onClose={() => { if (!busy) setCancelTarget(null); }} title="Cancel this payment link?" description="Razorpay stops accepting payments on it. If the customer already paid, Razorpay refuses the cancel and nothing changes.">
        <ErrorNote message={actionError} />
        <form onSubmit={cancelLink} className="space-y-4">
          <ReasonField value={reason} onChange={setReason} />
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryBtn} onClick={() => setCancelTarget(null)} disabled={busy}>Keep it</button>
            <button type="submit" className={primaryBtn} disabled={busy || !reasonOk(reason)}>{busy ? 'Cancelling…' : 'Cancel link'}</button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
