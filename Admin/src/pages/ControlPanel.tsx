import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal, Power, Megaphone, Tag, ShieldCheck, RotateCcw, AlertTriangle, Trash2, RefreshCw } from 'lucide-react';
import { adminFetch } from '../lib/api';
import { fmtDateTime, inr, tierLabel } from '../lib/format';
import { Dialog, ErrorNote, SuccessNote, ReasonField, reasonOk, fieldClass, labelClass, primaryBtn, secondaryBtn, dangerBtn } from '../components/Dialog';

// ─── Types (mirror PlatformConfigService.getAdminView on the server) ───
interface KbLimits { maxDocuments: number; maxStorageMb: number; maxFileSizeMb: number; maxChunksPerWorkspace: number; maxKbAttachedPerAgent: number }
interface CalLimits { maxCalendarsPerWorkspace: number; maxBookingsPerMonth: number; apiCallsPerMinute: number }
interface PlanValues { price: number; minutes: number; maxConcurrentCalls: number; purchasable: boolean; kbLimits: KbLimits; calendarLimits: CalLimits }
interface PlanRow { key: string; name: string; accountType: string; overridden: boolean; live: PlanValues; defaults: PlanValues }
interface Switches {
  maintenanceBanner: { enabled: boolean; message: string; level: 'info' | 'warning' | 'critical' };
  signupsPaused: boolean;
  signupsPausedMessage: string;
  outboundCallingPaused: boolean;
  outboundPausedMessage: string;
}
interface Caps { maxMinutesPerGrant: number | null; maxMinutesPerDay: number | null; maxDiscountPercent: number; canGrant: boolean; canDeduct: boolean; editable: boolean; overridden: boolean; updatedBy?: string | null; updatedAt?: string | null }
interface View { plans: PlanRow[]; switches: Switches; caps: Record<string, Caps>; meta: Record<string, { updatedBy?: string; updatedAt?: string }>; status: { loaded: boolean; lastRefreshAt: string | null; lastRefreshError: string | null } }
interface Announcement { id: string; message: string; isImportant: boolean; createdAt: string; readOrDismissedBy: number }

const KB_FIELDS: Array<[keyof KbLimits, string]> = [
  ['maxDocuments', 'Knowledge documents'],
  ['maxStorageMb', 'Knowledge storage (MB)'],
  ['maxFileSizeMb', 'Max file size (MB)'],
  ['maxChunksPerWorkspace', 'Knowledge chunks'],
  ['maxKbAttachedPerAgent', 'Knowledge bases per agent'],
];
const CAL_FIELDS: Array<[keyof CalLimits, string]> = [
  ['maxCalendarsPerWorkspace', 'Calendars'],
  ['maxBookingsPerMonth', 'Bookings per month'],
  ['apiCallsPerMinute', 'Calendar API calls per minute'],
];

type Pending =
  | { kind: 'plan'; key: string; name: string; values: PlanValues; changes: string[] }
  | { kind: 'reset'; key: string; name: string }
  | { kind: 'switches'; values: Partial<Switches>; changes: string[]; danger: boolean }
  | { kind: 'caps'; role: string; values: Omit<Caps, 'editable' | 'overridden' | 'updatedBy' | 'updatedAt'>; changes: string[] }
  | { kind: 'announce'; message: string; isImportant: boolean }
  | { kind: 'deleteAnnouncement'; id: string; message: string };

function diffPlan(before: PlanValues, after: PlanValues): string[] {
  const out: string[] = [];
  if (before.price !== after.price) out.push(`Price ${inr(before.price)} → ${inr(after.price)}`);
  if (before.minutes !== after.minutes) out.push(`Minutes ${before.minutes.toLocaleString('en-IN')} → ${after.minutes.toLocaleString('en-IN')}`);
  if (before.maxConcurrentCalls !== after.maxConcurrentCalls) out.push(`Calls at the same time ${before.maxConcurrentCalls} → ${after.maxConcurrentCalls}`);
  if (before.purchasable !== after.purchasable) out.push(after.purchasable ? 'Put on sale' : 'Taken off sale (cannot be bought)');
  for (const [f, label] of KB_FIELDS) if (before.kbLimits[f] !== after.kbLimits[f]) out.push(`${label} ${before.kbLimits[f].toLocaleString('en-IN')} → ${after.kbLimits[f].toLocaleString('en-IN')}`);
  for (const [f, label] of CAL_FIELDS) if (before.calendarLimits[f] !== after.calendarLimits[f]) out.push(`${label} ${before.calendarLimits[f].toLocaleString('en-IN')} → ${after.calendarLimits[f].toLocaleString('en-IN')}`);
  return out;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export const ControlPanel: React.FC = () => {
  const [view, setView] = useState<View | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, PlanValues>>({});
  const [openLimits, setOpenLimits] = useState<string | null>(null);
  const [switchDraft, setSwitchDraft] = useState<Switches | null>(null);
  const [capDrafts, setCapDrafts] = useState<Record<string, Caps>>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState({ message: '', isImportant: false });
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const applyView = useCallback((v: View) => {
    setView(v);
    setDrafts(Object.fromEntries(v.plans.map((p) => [p.key, clone(p.live)])));
    setSwitchDraft(clone(v.switches));
    setCapDrafts(clone(v.caps));
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [platform, ann] = await Promise.all([
        adminFetch<{ success: boolean; data: View }>('/api/v2/admin/platform'),
        adminFetch<{ success: boolean; data: Announcement[] }>('/api/v2/admin/announcements'),
      ]);
      applyView(platform.data);
      setAnnouncements(ann.data || []);
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load the control panel');
    } finally {
      setLoading(false);
    }
  }, [applyView]);

  useEffect(() => { load(); }, [load]);

  const switchChanges = useMemo(() => {
    if (!view || !switchDraft) return [] as string[];
    const a = view.switches;
    const b = switchDraft;
    const out: string[] = [];
    if (a.outboundCallingPaused !== b.outboundCallingPaused) out.push(b.outboundCallingPaused ? 'PAUSE all outgoing calls, campaigns and scheduled calls' : 'Resume outgoing calling');
    if (a.outboundPausedMessage !== b.outboundPausedMessage) out.push('Change the "calling paused" message');
    if (a.signupsPaused !== b.signupsPaused) out.push(b.signupsPaused ? 'PAUSE new sign-ups' : 'Open sign-ups again');
    if (a.signupsPausedMessage !== b.signupsPausedMessage) out.push('Change the "sign-ups paused" message');
    if (a.maintenanceBanner.enabled !== b.maintenanceBanner.enabled) out.push(b.maintenanceBanner.enabled ? 'Show the banner to every customer' : 'Hide the banner');
    if (a.maintenanceBanner.message !== b.maintenanceBanner.message) out.push('Change the banner text');
    if (a.maintenanceBanner.level !== b.maintenanceBanner.level) out.push(`Banner colour: ${b.maintenanceBanner.level}`);
    return out;
  }, [view, switchDraft]);

  const openConfirm = (p: Pending) => {
    setPending(p);
    setReason('');
    setActionError(null);
  };

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending) return;
    const needsReason = pending.kind !== 'announce' && pending.kind !== 'deleteAnnouncement';
    if (needsReason && !reasonOk(reason)) return;
    setBusy(true);
    setActionError(null);
    try {
      const r = reason.trim();
      if (pending.kind === 'plan') {
        const res = await adminFetch<{ data: View }>(`/api/v2/admin/platform/plans/${pending.key}`, { method: 'PUT', body: JSON.stringify({ plan: pending.values, reason: r }) });
        applyView(res.data);
        setNotice(`${pending.name} saved. New checkouts use it now; the website shows it within a minute.`);
      } else if (pending.kind === 'reset') {
        const res = await adminFetch<{ data: View }>(`/api/v2/admin/platform/plans/${pending.key}/reset`, { method: 'POST', body: JSON.stringify({ reason: r }) });
        applyView(res.data);
        setNotice(`${pending.name} is back to the standard values.`);
      } else if (pending.kind === 'switches') {
        const res = await adminFetch<{ data: View }>('/api/v2/admin/platform/switches', { method: 'PUT', body: JSON.stringify({ switches: pending.values, reason: r }) });
        applyView(res.data);
        setNotice('Switches saved. They apply at once (within 30 seconds on every server).');
      } else if (pending.kind === 'caps') {
        const res = await adminFetch<{ data: View }>(`/api/v2/admin/platform/caps/${pending.role}`, { method: 'PUT', body: JSON.stringify({ caps: pending.values, reason: r }) });
        applyView(res.data);
        setNotice(`Caps for ${pending.role} saved.`);
      } else if (pending.kind === 'announce') {
        await adminFetch('/api/v2/admin/announcements', { method: 'POST', body: JSON.stringify({ message: pending.message, isImportant: pending.isImportant, reason: r || 'Announcement to all customers' }) });
        setNewAnnouncement({ message: '', isImportant: false });
        setNotice('Announcement posted to every customer\'s notification bell.');
        const ann = await adminFetch<{ data: Announcement[] }>('/api/v2/admin/announcements');
        setAnnouncements(ann.data || []);
      } else if (pending.kind === 'deleteAnnouncement') {
        await adminFetch(`/api/v2/admin/announcements/${pending.id}/delete`, { method: 'POST', body: JSON.stringify({ reason: r || 'Announcement removed' }) });
        setAnnouncements((list) => list.filter((a) => a.id !== pending.id));
        setNotice('Announcement removed from every customer\'s bell.');
      }
      setPending(null);
    } catch (err: any) {
      setActionError(err?.message || 'The change was not saved');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !view) {
    return (
      <div className="py-20 text-center text-zinc-500">
        <div className="h-6 w-6 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">Loading control panel…</p>
      </div>
    );
  }
  if (loadError || !view || !switchDraft) {
    return (
      <div className="p-8 text-center bg-zinc-950 border border-zinc-800 rounded-2xl space-y-3">
        <AlertTriangle className="h-8 w-8 text-red-400 mx-auto" />
        <p className="text-sm text-white">Could not load the control panel</p>
        <p className="text-xs text-zinc-400 break-words">{loadError}</p>
        <button onClick={load} className={primaryBtn}>Try again</button>
      </div>
    );
  }

  const numberInput = (value: number, onChange: (n: number) => void, min = 1, max?: number) => (
    <input
      type="number"
      min={min}
      max={max}
      step={1}
      value={Number.isFinite(value) ? value : ''}
      onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
      className={fieldClass + ' font-mono'}
    />
  );

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5" />
            <span>Control Panel</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Change prices, plans and platform switches here instead of in the code. Every change needs a reason and is saved in the audit log.</p>
        </div>
        <button onClick={load} className={secondaryBtn + ' flex items-center gap-1.5 self-start'}><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>
      </div>

      <SuccessNote message={notice} />
      {view.status.lastRefreshError && <ErrorNote message={`The server could not re-read the settings recently (${view.status.lastRefreshError}). It keeps using the last values it loaded.`} />}

      {/* ── Platform switches ── */}
      <section className={`border rounded-2xl p-5 space-y-5 ${view.switches.outboundCallingPaused ? 'bg-red-950/20 border-red-800/60' : 'bg-zinc-950 border-zinc-800'}`}>
        <div className="flex items-center gap-2">
          <Power className="h-4 w-4" />
          <h2 className="text-sm font-bold text-white uppercase font-mono">Platform switches</h2>
          {view.switches.outboundCallingPaused && <span className="text-[10px] px-2 py-0.5 rounded bg-red-600 text-white font-bold">CALLING PAUSED</span>}
          {view.switches.signupsPaused && <span className="text-[10px] px-2 py-0.5 rounded bg-amber-600 text-black font-bold">SIGN-UPS PAUSED</span>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-black border border-zinc-800 space-y-3 min-w-0">
            <label className="flex items-center justify-between gap-3 text-xs text-white font-semibold">
              <span>Pause all outgoing calls</span>
              <input type="checkbox" checked={switchDraft.outboundCallingPaused} onChange={(e) => setSwitchDraft({ ...switchDraft, outboundCallingPaused: e.target.checked })} className="h-4 w-4" />
            </label>
            <p className="text-[11px] text-zinc-400">Emergency stop: no new outgoing call, campaign call or scheduled call is placed. Calls already in progress continue. Incoming calls are not affected. Paused campaigns resume by themselves when you switch this off.</p>
            <div>
              <label className={labelClass}>Message customers see</label>
              <textarea rows={2} maxLength={300} value={switchDraft.outboundPausedMessage} onChange={(e) => setSwitchDraft({ ...switchDraft, outboundPausedMessage: e.target.value })} className={fieldClass} />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-black border border-zinc-800 space-y-3 min-w-0">
            <label className="flex items-center justify-between gap-3 text-xs text-white font-semibold">
              <span>Pause new sign-ups</span>
              <input type="checkbox" checked={switchDraft.signupsPaused} onChange={(e) => setSwitchDraft({ ...switchDraft, signupsPaused: e.target.checked })} className="h-4 w-4" />
            </label>
            <p className="text-[11px] text-zinc-400">No new accounts (email or Google). Existing customers sign in as usual.</p>
            <div>
              <label className={labelClass}>Message on the sign-up page</label>
              <textarea rows={2} maxLength={300} value={switchDraft.signupsPausedMessage} onChange={(e) => setSwitchDraft({ ...switchDraft, signupsPausedMessage: e.target.value })} className={fieldClass} />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-black border border-zinc-800 space-y-3 min-w-0">
            <label className="flex items-center justify-between gap-3 text-xs text-white font-semibold">
              <span>Banner on every dashboard</span>
              <input type="checkbox" checked={switchDraft.maintenanceBanner.enabled} onChange={(e) => setSwitchDraft({ ...switchDraft, maintenanceBanner: { ...switchDraft.maintenanceBanner, enabled: e.target.checked } })} className="h-4 w-4" />
            </label>
            <div>
              <label className={labelClass}>Banner text</label>
              <textarea rows={2} maxLength={300} value={switchDraft.maintenanceBanner.message} placeholder="e.g. Planned maintenance tonight 2-3 AM IST" onChange={(e) => setSwitchDraft({ ...switchDraft, maintenanceBanner: { ...switchDraft.maintenanceBanner, message: e.target.value } })} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Colour</label>
              <select value={switchDraft.maintenanceBanner.level} onChange={(e) => setSwitchDraft({ ...switchDraft, maintenanceBanner: { ...switchDraft.maintenanceBanner, level: e.target.value as Switches['maintenanceBanner']['level'] } })} className={fieldClass}>
                <option value="info">Blue (information)</option>
                <option value="warning">Amber (warning)</option>
                <option value="critical">Red (critical)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={secondaryBtn} disabled={switchChanges.length === 0} onClick={() => setSwitchDraft(clone(view.switches))}>Undo changes</button>
          <button
            type="button"
            className={switchDraft.outboundCallingPaused && !view.switches.outboundCallingPaused ? dangerBtn : primaryBtn}
            disabled={switchChanges.length === 0}
            onClick={() => openConfirm({ kind: 'switches', values: switchDraft, changes: switchChanges, danger: switchDraft.outboundCallingPaused || switchDraft.signupsPaused })}
          >
            Save switches
          </button>
        </div>
        {view.meta['platform.switches']?.updatedBy && (
          <p className="text-[10px] text-zinc-500 font-mono">Last changed by {view.meta['platform.switches'].updatedBy} · {fmtDateTime(view.meta['platform.switches'].updatedAt)}</p>
        )}
      </section>

      {/* ── Plans & prices ── */}
      <section className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4" />
          <h2 className="text-sm font-bold text-white uppercase font-mono">Plans & prices</h2>
        </div>
        <p className="text-[11px] text-zinc-400">These are the prices customers are charged at checkout and the limits their plan gets. A change applies to new checkouts at once; anyone already paying keeps the price and minutes they saw. The website pricing reads these live (search-engine copies of the page update on the next site deploy). Prices are one-time, GST inclusive, in whole rupees.</p>

        <div className="space-y-3">
          {view.plans.map((p) => {
            const d = drafts[p.key];
            if (!d) return null;
            const changes = diffPlan(p.live, d);
            const invalid = [d.price, d.minutes, d.maxConcurrentCalls, ...Object.values(d.kbLimits), ...Object.values(d.calendarLimits)].some((n) => !Number.isInteger(n) || n < 1);
            const rate = d.minutes > 0 ? (d.price / d.minutes).toFixed(2) : '—';
            return (
              <div key={p.key} className="p-4 rounded-xl bg-black border border-zinc-800 space-y-3 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="text-sm font-bold text-white">{p.name}</span>
                    <span className="text-[10px] font-mono text-zinc-500">{p.key} · {tierLabel(p.accountType)} features</span>
                    {p.overridden && <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/60 font-mono">CHANGED FROM STANDARD</span>}
                    {!p.live.purchasable && <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60 font-mono">NOT ON SALE</span>}
                  </div>
                  <span className="text-[11px] text-zinc-400 font-mono">₹{rate} / min</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className={labelClass}>Price (₹)</label>
                    {numberInput(d.price, (n) => setDrafts({ ...drafts, [p.key]: { ...d, price: n } }), 1, 10000000)}
                    <p className="text-[10px] text-zinc-500 mt-1">Standard {inr(p.defaults.price)}</p>
                  </div>
                  <div>
                    <label className={labelClass}>Minutes</label>
                    {numberInput(d.minutes, (n) => setDrafts({ ...drafts, [p.key]: { ...d, minutes: n } }), 1, 1000000)}
                    <p className="text-[10px] text-zinc-500 mt-1">Standard {p.defaults.minutes.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <label className={labelClass}>Calls at once</label>
                    {numberInput(d.maxConcurrentCalls, (n) => setDrafts({ ...drafts, [p.key]: { ...d, maxConcurrentCalls: n } }), 1, 100)}
                    <p className="text-[10px] text-zinc-500 mt-1">Standard {p.defaults.maxConcurrentCalls}</p>
                  </div>
                  <div>
                    <label className={labelClass}>On sale</label>
                    <select value={d.purchasable ? 'yes' : 'no'} onChange={(e) => setDrafts({ ...drafts, [p.key]: { ...d, purchasable: e.target.value === 'yes' } })} className={fieldClass}>
                      <option value="yes">Yes, can be bought</option>
                      <option value="no">No, hidden at checkout</option>
                    </select>
                  </div>
                </div>

                <button type="button" onClick={() => setOpenLimits(openLimits === p.key ? null : p.key)} className="text-[11px] text-zinc-300 hover:text-white underline cursor-pointer">
                  {openLimits === p.key ? 'Hide' : 'Show'} knowledge-base and calendar limits
                </button>
                {openLimits === p.key && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {KB_FIELDS.map(([f, label]) => (
                      <div key={f}>
                        <label className={labelClass}>{label}</label>
                        {numberInput(d.kbLimits[f], (n) => setDrafts({ ...drafts, [p.key]: { ...d, kbLimits: { ...d.kbLimits, [f]: n } } }))}
                        <p className="text-[10px] text-zinc-500 mt-1">Standard {p.defaults.kbLimits[f].toLocaleString('en-IN')}</p>
                      </div>
                    ))}
                    {CAL_FIELDS.map(([f, label]) => (
                      <div key={f}>
                        <label className={labelClass}>{label}</label>
                        {numberInput(d.calendarLimits[f], (n) => setDrafts({ ...drafts, [p.key]: { ...d, calendarLimits: { ...d.calendarLimits, [f]: n } } }))}
                        <p className="text-[10px] text-zinc-500 mt-1">Standard {p.defaults.calendarLimits[f].toLocaleString('en-IN')}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap justify-end gap-2">
                  {p.overridden && (
                    <button type="button" className={secondaryBtn + ' flex items-center gap-1.5'} onClick={() => openConfirm({ kind: 'reset', key: p.key, name: p.name })}>
                      <RotateCcw className="h-3.5 w-3.5" /> Back to standard
                    </button>
                  )}
                  <button type="button" className={secondaryBtn} disabled={changes.length === 0} onClick={() => setDrafts({ ...drafts, [p.key]: clone(p.live) })}>Undo</button>
                  <button type="button" className={primaryBtn} disabled={changes.length === 0 || invalid} onClick={() => openConfirm({ kind: 'plan', key: p.key, name: p.name, values: d, changes })}>
                    Save {p.name}
                  </button>
                </div>
                {invalid && <p className="text-[11px] text-red-300">Every value must be a whole number of 1 or more.</p>}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Announcements ── */}
      <section className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4" />
          <h2 className="text-sm font-bold text-white uppercase font-mono">Announcements</h2>
        </div>
        <p className="text-[11px] text-zinc-400">Appears in the notification bell of every customer.</p>
        <div className="space-y-3">
          <textarea rows={3} maxLength={2000} value={newAnnouncement.message} onChange={(e) => setNewAnnouncement({ ...newAnnouncement, message: e.target.value })} placeholder="e.g. New: Hindi voices are now available for all plans." className={fieldClass} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <input type="checkbox" checked={newAnnouncement.isImportant} onChange={(e) => setNewAnnouncement({ ...newAnnouncement, isImportant: e.target.checked })} />
              Mark as important
            </label>
            <button type="button" className={primaryBtn} disabled={!newAnnouncement.message.trim()} onClick={() => openConfirm({ kind: 'announce', message: newAnnouncement.message.trim(), isImportant: newAnnouncement.isImportant })}>Post to all customers</button>
          </div>
        </div>
        <div className="divide-y divide-zinc-800/60">
          {announcements.length === 0 && <p className="text-xs text-zinc-500 py-3">No announcements yet.</p>}
          {announcements.map((a) => (
            <div key={a.id} className="py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-white whitespace-pre-wrap break-words">{a.isImportant && <span className="text-[10px] mr-2 px-1.5 py-0.5 rounded bg-amber-600 text-black font-bold">IMPORTANT</span>}{a.message}</p>
                <p className="text-[10px] text-zinc-500 font-mono mt-1">{fmtDateTime(a.createdAt)} · read or dismissed by {a.readOrDismissedBy}</p>
              </div>
              <button type="button" aria-label="Delete announcement" className="p-2 rounded-lg text-zinc-400 hover:text-red-300 hover:bg-zinc-900 cursor-pointer shrink-0" onClick={() => openConfirm({ kind: 'deleteAnnouncement', id: a.id, message: a.message })}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Staff caps ── */}
      <section className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          <h2 className="text-sm font-bold text-white uppercase font-mono">Staff limits</h2>
        </div>
        <p className="text-[11px] text-zinc-400">How many free minutes each role may give, and the largest discount it may offer. The owner is always unlimited.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300 min-w-[720px]">
            <thead className="text-[11px] uppercase tracking-wider text-zinc-400 font-mono border-b border-zinc-800">
              <tr>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Minutes per grant</th>
                <th className="px-3 py-2">Minutes per day</th>
                <th className="px-3 py-2">Max discount %</th>
                <th className="px-3 py-2">Can grant</th>
                <th className="px-3 py-2">Can deduct</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {Object.entries(capDrafts).map(([role, c]) => {
                const live = view.caps[role];
                const changed = JSON.stringify(live) !== JSON.stringify(c);
                const set = (patch: Partial<Caps>) => setCapDrafts({ ...capDrafts, [role]: { ...c, ...patch } });
                if (!c.editable) {
                  return (
                    <tr key={role}>
                      <td className="px-3 py-2 font-bold uppercase text-white">{role}</td>
                      <td className="px-3 py-2" colSpan={6}>Unlimited (fixed)</td>
                    </tr>
                  );
                }
                const nums = [c.maxMinutesPerGrant, c.maxMinutesPerDay, c.maxDiscountPercent];
                const invalid = nums.some((n) => n === null || !Number.isInteger(n) || n < 0) || (c.maxMinutesPerGrant ?? 0) > (c.maxMinutesPerDay ?? 0) || c.maxDiscountPercent > 100;
                return (
                  <tr key={role}>
                    <td className="px-3 py-2 font-bold uppercase text-white">{role}</td>
                    <td className="px-3 py-2 w-32">{numberInput(c.maxMinutesPerGrant ?? NaN, (n) => set({ maxMinutesPerGrant: n }), 0, 100000)}</td>
                    <td className="px-3 py-2 w-32">{numberInput(c.maxMinutesPerDay ?? NaN, (n) => set({ maxMinutesPerDay: n }), 0, 1000000)}</td>
                    <td className="px-3 py-2 w-28">{numberInput(c.maxDiscountPercent, (n) => set({ maxDiscountPercent: n }), 0, 100)}</td>
                    <td className="px-3 py-2"><input type="checkbox" checked={c.canGrant} onChange={(e) => set({ canGrant: e.target.checked })} /></td>
                    <td className="px-3 py-2"><input type="checkbox" checked={c.canDeduct} onChange={(e) => set({ canDeduct: e.target.checked })} /></td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className={primaryBtn}
                        disabled={!changed || invalid}
                        onClick={() => openConfirm({
                          kind: 'caps',
                          role,
                          values: { maxMinutesPerGrant: c.maxMinutesPerGrant, maxMinutesPerDay: c.maxMinutesPerDay, maxDiscountPercent: c.maxDiscountPercent, canGrant: c.canGrant, canDeduct: c.canDeduct },
                          changes: [`${role}: ${c.maxMinutesPerGrant} per grant, ${c.maxMinutesPerDay} per day, ${c.maxDiscountPercent}% discount, grant ${c.canGrant ? 'yes' : 'no'}, deduct ${c.canDeduct ? 'yes' : 'no'}`],
                        })}
                      >
                        Save
                      </button>
                      {invalid && <p className="text-[10px] text-red-300 mt-1">Per grant must not exceed per day.</p>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Confirmation ── */}
      <Dialog
        open={pending !== null}
        onClose={() => { if (!busy) setPending(null); }}
        title={
          pending?.kind === 'plan' ? `Save ${pending.name}?`
            : pending?.kind === 'reset' ? `Put ${pending.name} back to standard?`
              : pending?.kind === 'switches' ? 'Save platform switches?'
                : pending?.kind === 'caps' ? 'Save staff limits?'
                  : pending?.kind === 'announce' ? 'Post this to every customer?'
                    : 'Delete this announcement?'
        }
      >
        <ErrorNote message={actionError} />
        <form onSubmit={run} className="space-y-4">
          {(pending?.kind === 'plan' || pending?.kind === 'switches' || pending?.kind === 'caps') && (
            <ul className="text-xs text-zinc-200 list-disc pl-5 space-y-1">
              {pending.changes.map((c) => <li key={c} className="break-words">{c}</li>)}
            </ul>
          )}
          {pending?.kind === 'switches' && pending.danger && (
            <p className="text-xs text-red-300">Customers are affected immediately. Remember to switch it back when you are done.</p>
          )}
          {(pending?.kind === 'announce' || pending?.kind === 'deleteAnnouncement') && (
            <p className="text-xs text-zinc-200 whitespace-pre-wrap break-words p-3 rounded-xl bg-black border border-zinc-800">{pending.message}</p>
          )}
          {pending?.kind !== 'announce' && pending?.kind !== 'deleteAnnouncement' && <ReasonField value={reason} onChange={setReason} />}
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryBtn} onClick={() => setPending(null)} disabled={busy}>Cancel</button>
            <button
              type="submit"
              className={pending?.kind === 'deleteAnnouncement' || (pending?.kind === 'switches' && pending.danger) ? dangerBtn : primaryBtn}
              disabled={busy || (pending?.kind !== 'announce' && pending?.kind !== 'deleteAnnouncement' && !reasonOk(reason))}
            >
              {busy ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
