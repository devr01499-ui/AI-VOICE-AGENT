import React from 'react';
import { Settings as SettingsIcon, Shield, Lock, Globe, CheckCircle2 } from 'lucide-react';

export const Settings: React.FC = () => {

  const roleCaps = [
    { role: 'owner', grantPerAction: 'Unlimited', grantPerDay: 'Unlimited', maxDiscount: '100%', canDeduct: 'Yes' },
    { role: 'admin', grantPerAction: '500 mins', grantPerDay: '5,000 mins', maxDiscount: '30%', canDeduct: 'Yes' },
    { role: 'sales', grantPerAction: '100 mins', grantPerDay: '500 mins', maxDiscount: '15%', canDeduct: 'No' },
    { role: 'support', grantPerAction: '50 mins', grantPerDay: '200 mins', maxDiscount: '0%', canDeduct: 'No' },
    { role: 'finance', grantPerAction: '0 mins', grantPerDay: '0 mins', maxDiscount: '0%', canDeduct: 'No' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-white" />
          <span>System Governance & Security Settings</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Role-based operational limits, network boundaries, and cryptographic policy.
        </p>
      </div>

      {/* Role Limits Matrix Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-white" />
            <h2 className="text-sm font-bold text-white uppercase font-mono">
              Staff Role Caps (Founder Decision #3)
            </h2>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            ENFORCED SERVER-SIDE
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Per-Action Grant Cap</th>
                <th className="px-4 py-3">Daily Grant Cap</th>
                <th className="px-4 py-3">Max Negotiated Discount</th>
                <th className="px-4 py-3">Minutes Deduction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {roleCaps.map((c) => (
                <tr key={c.role} className="hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-bold uppercase text-white">{c.role}</td>
                  <td className="px-4 py-3 text-slate-300">{c.grantPerAction}</td>
                  <td className="px-4 py-3 text-slate-300">{c.grantPerDay}</td>
                  <td className="px-4 py-3 text-white font-bold">{c.maxDiscount}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.canDeduct === 'Yes'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {c.canDeduct}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Network & Infrastructure Security */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-white" />
            <h3 className="text-xs font-bold text-white uppercase font-mono">
              Network & Origin Isolation
            </h3>
          </div>
          <div className="space-y-2.5 text-xs text-slate-300">
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Allowed Admin Origin</span>
              <span className="font-mono text-white text-[11px]">admin.claritiy.com</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Strict IP Allowlist</span>
              <span className="font-mono text-emerald-400 text-[11px] flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Enabled (ADMIN_IP_ALLOWLIST)
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Staff Rate Limiter</span>
              <span className="font-mono text-slate-300 text-[11px]">120 req / min / staff</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-white" />
            <h3 className="text-xs font-bold text-white uppercase font-mono">
              Auth & Session Security
            </h3>
          </div>
          <div className="space-y-2.5 text-xs text-slate-300">
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Authentication Level</span>
              <span className="font-mono text-white text-[11px]">Supabase AAL2 (TOTP MFA)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Session Max Inactivity</span>
              <span className="font-mono text-slate-300 text-[11px]">15 minutes</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Call Content (Recordings/Transcripts)</span>
              <span className="font-mono text-white text-[11px] font-bold">
                Owner Only (Decision #4)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
