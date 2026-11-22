import { useCallback, useEffect, useState } from 'react';
import { MessageCircle, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Copy, Check, ShieldCheck } from 'lucide-react';
import {
  connectWhatsAppAccount,
  disconnectWhatsAppAccount,
  fetchWhatsAppAccount,
  syncWhatsAppTemplates,
  type WhatsAppAccountInfo,
} from '../../api';

/**
 * WhatsApp Business (the customer's OWN Meta account, Cloud API). Messages go out in the business's
 * name from its verified number, and Meta bills the business directly. Agents send only approved
 * templates, only after the caller agrees on the call.
 */
export function WhatsAppIntegrationCard() {
  const [account, setAccount] = useState<WhatsAppAccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<'connect' | 'sync' | 'disconnect' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({ phoneNumberId: '', wabaId: '', accessToken: '', appSecret: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchWhatsAppAccount();
      setAccount(r.account);
    } catch {
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const connect = async () => {
    setError(null);
    if (!/^\d{5,25}$/.test(form.phoneNumberId.trim()) || !/^\d{5,25}$/.test(form.wabaId.trim())) {
      setError('The Phone number ID and the WhatsApp Business Account ID are long numbers (digits only).');
      return;
    }
    if (form.accessToken.trim().length < 20 || !/^[a-f0-9]{32}$/i.test(form.appSecret.trim())) {
      setError('Paste the full permanent access token and the 32-character App secret.');
      return;
    }
    setBusy('connect');
    try {
      const r = await connectWhatsAppAccount({
        phoneNumberId: form.phoneNumberId.trim(),
        wabaId: form.wabaId.trim(),
        accessToken: form.accessToken.trim(),
        appSecret: form.appSecret.trim(),
      });
      setAccount(r.account);
      setShowForm(false);
      setForm({ phoneNumberId: '', wabaId: '', accessToken: '', appSecret: '' });
    } catch (e: any) {
      setError(e?.message || 'WhatsApp could not be connected. Please check the details and try again.');
    } finally {
      setBusy(null);
    }
  };

  const sync = async () => {
    setError(null);
    setBusy('sync');
    try { setAccount((await syncWhatsAppTemplates()).account); } catch (e: any) { setError(e?.message || 'Templates could not be refreshed.'); } finally { setBusy(null); }
  };

  const disconnect = async () => {
    if (!window.confirm('Disconnect WhatsApp? Agents will stop sending WhatsApp messages until you connect again.')) return;
    setError(null);
    setBusy('disconnect');
    try { await disconnectWhatsAppAccount(); setAccount(null); } catch (e: any) { setError(e?.message || 'WhatsApp could not be disconnected.'); } finally { setBusy(null); }
  };

  const copy = async (label: string, value: string) => {
    try { await navigator.clipboard.writeText(value); setCopied(label); setTimeout(() => setCopied(null), 1500); } catch { /* clipboard blocked */ }
  };

  const usable = account?.templates.filter((t) => t.usable) || [];
  const notUsable = account?.templates.filter((t) => !t.usable) || [];
  const input = 'w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <div data-testid="whatsapp-integration" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col space-y-4 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">WhatsApp Business</h3>
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Messages from your agents</span>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 whitespace-nowrap ${account?.status === 'connected' ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300' : account ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
          {account?.status === 'connected' ? <><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Connected</> : account ? <><AlertTriangle className="w-3 h-3" /> Needs attention</> : <><XCircle className="w-3 h-3 text-slate-400" /> Not Connected</>}
        </span>
      </div>

      {error && <div role="alert" className="p-3 rounded-xl text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 break-words">{error}</div>}

      {loading ? (
        <p className="text-xs text-slate-400">Checking WhatsApp…</p>
      ) : !account ? (
        <>
          <p className="text-xs text-slate-500 leading-relaxed">
            Let your agents send approved WhatsApp messages (booking confirmations, brochures, payment or location links) to callers who agree on the call. Messages come from your own verified WhatsApp Business number; Meta bills your business directly for them.
          </p>
          {!showForm ? (
            <button type="button" onClick={() => setShowForm(true)} className="self-start px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold">Connect WhatsApp</button>
          ) : (
            <div className="space-y-3">
              <details className="text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                <summary className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">Where to find these details</summary>
                <ol className="list-decimal ml-4 mt-2 space-y-1">
                  <li>You need a Meta Business account with a WhatsApp Business number on the Cloud API.</li>
                  <li>WhatsApp Manager → API setup: copy the <b>Phone number ID</b> and the <b>WhatsApp Business Account ID</b>.</li>
                  <li>Business Settings → System users: create a <b>permanent access token</b> with <code>whatsapp_business_messaging</code> and <code>whatsapp_business_management</code>.</li>
                  <li>Your Meta app → App settings → Basic: copy the <b>App secret</b> (used to check that webhooks really come from Meta).</li>
                  <li>Create and get approval for your message templates in WhatsApp Manager.</li>
                </ol>
              </details>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">Phone number ID
                <input className={input} inputMode="numeric" value={form.phoneNumberId} onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })} placeholder="e.g. 106540352242922" />
              </label>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">WhatsApp Business Account ID
                <input className={input} inputMode="numeric" value={form.wabaId} onChange={(e) => setForm({ ...form, wabaId: e.target.value })} placeholder="e.g. 102290129340398" />
              </label>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">Permanent access token
                <input className={input} type="password" autoComplete="off" value={form.accessToken} onChange={(e) => setForm({ ...form, accessToken: e.target.value })} placeholder="EAAG…" />
              </label>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">App secret
                <input className={input} type="password" autoComplete="off" value={form.appSecret} onChange={(e) => setForm({ ...form, appSecret: e.target.value })} placeholder="32 letters and numbers" />
              </label>
              <p className="text-[10px] text-slate-400 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Checked with Meta before saving. Stored encrypted; never shown again.</p>
              <div className="flex gap-2">
                <button type="button" onClick={connect} disabled={busy === 'connect'} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold disabled:opacity-50">{busy === 'connect' ? 'Checking with Meta…' : 'Save and connect'}</button>
                <button type="button" onClick={() => { setShowForm(false); setError(null); }} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold">Cancel</button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">Number</span>
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 truncate">{account.displayPhoneNumber || account.phoneNumberId}</span>
          </div>
          {account.verifiedName && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Business name</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{account.verifiedName}</span>
            </div>
          )}
          {account.lastError && <p className="text-[11px] text-amber-700 dark:text-amber-300 break-words">{account.lastError}</p>}

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
            <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Delivery reports and replies {account.webhookVerifiedAt ? <span className="text-emerald-600">✓ webhook verified</span> : <span className="text-amber-600">(webhook not verified yet)</span>}
            </p>
            <p className="text-[10px] text-slate-500">In your Meta app → WhatsApp → Configuration, paste these and subscribe to <b>messages</b>. Replies such as STOP then opt the person out automatically.</p>
            {[{ label: 'Callback URL', value: account.webhookUrl }, ...(account.verifyToken ? [{ label: 'Verify token', value: account.verifyToken }] : [])].map((row) => (
              <div key={row.label} className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] text-slate-400 w-20 flex-shrink-0">{row.label}</span>
                <code className="flex-1 min-w-0 truncate text-[10px] bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">{row.value}</code>
                <button type="button" aria-label={`Copy ${row.label}`} onClick={() => copy(row.label, row.value)} className="p-1 text-slate-400 hover:text-emerald-600">{copied === row.label ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}</button>
              </div>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Templates your agents can send ({usable.length})</span>
              <button type="button" onClick={sync} disabled={busy === 'sync'} className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 disabled:opacity-50"><RefreshCw className={`w-3 h-3 ${busy === 'sync' ? 'animate-spin' : ''}`} /> Refresh</button>
            </div>
            {usable.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic">No approved templates yet. Create one in WhatsApp Manager, wait for approval, then refresh.</p>
            ) : (
              <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {usable.map((t) => (
                  <li key={`${t.name}-${t.language}`} className="p-2 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap"><span className="font-mono font-semibold text-[11px]">{t.name}</span><span className="text-[9px] uppercase text-slate-500">{t.language} · {t.category.toLowerCase()}</span></div>
                    <p className="text-[10px] text-slate-500 line-clamp-2 break-words">{t.bodyText}</p>
                  </li>
                ))}
              </ul>
            )}
            {notUsable.length > 0 && (
              <details className="mt-2 text-[10px] text-slate-500">
                <summary className="cursor-pointer">{notUsable.length} template(s) cannot be sent by an agent</summary>
                <ul className="mt-1 space-y-0.5">{notUsable.map((t) => <li key={`${t.name}-${t.language}`} className="break-words"><span className="font-mono">{t.name}</span>: {t.unusableReason}</li>)}</ul>
              </details>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">Agents ask before sending</span>
            <button type="button" onClick={disconnect} disabled={busy === 'disconnect'} className="text-xs text-rose-500 hover:text-rose-700 font-semibold disabled:opacity-50">{busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
