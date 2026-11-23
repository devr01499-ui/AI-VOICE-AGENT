/** Every date in the console is shown in Indian time, whatever the viewer's computer is set to. */
const IST: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Kolkata' };

export function fmtDateTime(v: string | number | Date | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleString('en-IN', { ...IST, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} IST`;
}

export function fmtDate(v: string | number | Date | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { ...IST, day: '2-digit', month: 'short', year: 'numeric' });
}

export function inr(n: number | null | undefined): string {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

/** Plan tier names as customers know them (the stored tier keys are older internal names). */
export const TIER_LABELS: Record<string, string> = {
  free: 'Free (no plan)',
  trial: 'Trial',
  starter: 'Starter',
  developer: 'Startup',
  professional: 'Growth',
  enterprise: 'Enterprise',
  admin: 'Platform admin',
};

export function tierLabel(t: string | null | undefined): string {
  return TIER_LABELS[String(t || 'free')] || String(t || 'free');
}
