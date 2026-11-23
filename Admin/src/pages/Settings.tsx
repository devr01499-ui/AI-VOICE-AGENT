import React, { useCallback, useEffect, useState } from 'react';
import { Settings as SettingsIcon, Shield, Lock, Globe, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { adminFetch } from '../lib/api';
import { ErrorNote, secondaryBtn } from '../components/Dialog';

interface SecurityState {
  strictAuth: boolean;
  ipAllowlistEnabled: boolean;
  adminOrigin: string;
  encryptionKeySet: boolean;
  twoFactorRequiredForAllRoles: boolean;
  staffRateLimitPerMinute: number;
}
interface CapRow { maxMinutesPerGrant: number | null; maxMinutesPerDay: number | null; maxDiscountPercent: number; canGrant: boolean; canDeduct: boolean; overridden: boolean }

const Row: React.FC<{ label: string; ok?: boolean; value: React.ReactNode; hint?: string }> = ({ label, ok, value, hint }) => (
  <div className="py-2 border-b border-zinc-800/60 last:border-0">
    <div className="flex justify-between gap-3">
      <span className="text-zinc-400">{label}</span>
      <span className={`font-mono text-[11px] flex items-center gap-1 text-right ${ok === undefined ? 'text-white' : ok ? 'text-emerald-400' : 'text-amber-300'}`}>
        {ok === true && <CheckCircle2 className="h-3 w-3 shrink-0" />}
        {ok === false && <XCircle className="h-3 w-3 shrink-0" />}
        <span className="break-all">{value}</span>
      </span>
    </div>
    {hint && <p className="text-[10px] text-zinc-500 mt-1">{hint}</p>}
  </div>
);

const minutesText = (n: number | null) => (n === null ? 'Unlimited' : `${n.toLocaleString('en-IN')} min`);

/** Read-only view of how the console is protected, taken from the running server. */
export const Settings: React.FC = () => {
  const [security, setSecurity] = useState<SecurityState | null>(null);
  const [caps, setCaps] = useState<Record<string, CapRow> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [health, platform] = await Promise.all([
        adminFetch<{ data: { security: SecurityState } }>('/api/v2/admin/health'),
        adminFetch<{ data: { caps: Record<string, CapRow> } }>('/api/v2/admin/platform'),
      ]);
      setSecurity(health.data.security);
      setCaps(platform.data.caps);
    } catch (err: any) {
      setError(err?.message || 'Could not load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            <span>Security Settings</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">How this console is protected right now, read from the live server. Server settings (environment variables) are changed on Render; staff limits are changed in the Control Panel.</p>
        </div>
        <button onClick={load} className={secondaryBtn + ' flex items-center gap-1.5 self-start'}><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>
      </div>

      <ErrorNote message={error} />
      {loading && !security && <p className="text-sm text-zinc-500">Loading…</p>}

      {security && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="h-4 w-4" />
              <h2 className="text-xs font-bold text-white uppercase font-mono">Sign-in protection</h2>
            </div>
            <div className="text-xs">
              <Row label="Admin access switch (ENABLE_STRICT_AUTH)" ok={security.strictAuth} value={security.strictAuth ? 'On' : 'Off — console refuses everyone'} />
              <Row label="Two-factor for every role (owner included)" ok={security.twoFactorRequiredForAllRoles} value={security.twoFactorRequiredForAllRoles ? 'Required' : 'Not required'} />
              <Row label="Per-person request limit" value={`${security.staffRateLimitPerMinute} / minute`} />
              <Row label="Call recordings and transcripts" value="Owner only" />
            </div>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="h-4 w-4" />
              <h2 className="text-xs font-bold text-white uppercase font-mono">Network and data</h2>
            </div>
            <div className="text-xs">
              <Row label="Allowed console address" value={security.adminOrigin} />
              <Row
                label="Office IP allowlist (ADMIN_IP_ALLOWLIST)"
                ok={security.ipAllowlistEnabled}
                value={security.ipAllowlistEnabled ? 'On' : 'Off'}
                hint={security.ipAllowlistEnabled ? undefined : 'Optional. When set on Render, the console only answers requests from those IP ranges.'}
              />
              <Row
                label="Encryption key for stored secrets (ENCRYPTION_KEY)"
                ok={security.encryptionKeySet}
                value={security.encryptionKeySet ? 'Set' : 'Missing'}
                hint={security.encryptionKeySet ? undefined : 'Set ENCRYPTION_KEY on Render (see docs/RUNBOOK.md).'}
              />
            </div>
          </div>
        </div>
      )}

      {caps && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4" />
            <h2 className="text-xs font-bold text-white uppercase font-mono">Staff limits in force</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300 min-w-[560px]">
              <thead className="text-[11px] uppercase tracking-wider text-zinc-400 font-mono border-b border-zinc-800">
                <tr><th className="px-3 py-2">Role</th><th className="px-3 py-2">Per grant</th><th className="px-3 py-2">Per day</th><th className="px-3 py-2">Max discount</th><th className="px-3 py-2">Deduct</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono">
                {Object.entries(caps).map(([role, c]) => (
                  <tr key={role}>
                    <td className="px-3 py-2 font-bold uppercase text-white">{role}{c.overridden && <span className="ml-2 text-[9px] text-blue-300">(edited)</span>}</td>
                    <td className="px-3 py-2">{c.canGrant ? minutesText(c.maxMinutesPerGrant) : 'Cannot grant'}</td>
                    <td className="px-3 py-2">{c.canGrant ? minutesText(c.maxMinutesPerDay) : '—'}</td>
                    <td className="px-3 py-2">{c.maxDiscountPercent}%</td>
                    <td className="px-3 py-2">{c.canDeduct ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
