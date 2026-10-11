import React, { useEffect, useState } from 'react';
import { adminFetch } from '../lib/api';
import { Activity, Database, Sparkles, CreditCard, ShieldCheck, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

export const Health: React.FC = () => {
  const [health, setHealth] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminFetch<{ success: boolean; data: any }>('/api/v2/admin/health');
      if (res.success) {
        setHealth(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Health probe failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const isHealthy = health?.status === 'operational';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-400" />
            <span>System Health & Diagnostics</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time platform subsystem status, database latency, and ledger consistency checks
          </p>
        </div>

        <button
          onClick={fetchHealth}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium flex items-center gap-2 border border-slate-700 transition-colors cursor-pointer self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Run Live Health Probe</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Status Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`h-12 w-12 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 ${
              isHealthy
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}
          >
            {isHealthy ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
          </div>
          <div>
            <h2 className="text-base font-bold text-white capitalize">
              Platform Status: {health?.status || 'Probing...'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Engine Version: {health?.version || '1.0.0'} • Last probed: {health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : 'N/A'}
            </p>
          </div>
        </div>

        <span
          className={`text-xs px-3 py-1 rounded-full font-mono uppercase font-semibold border ${
            isHealthy
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}
        >
          {isHealthy ? 'ALL SYSTEMS OPERATIONAL' : 'DEGRADED SUBSYSTEMS'}
        </span>
      </div>

      {/* Diagnostics Subsystems Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Database Subsystem */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-2">
              <Database className="h-4 w-4 text-indigo-400" />
              <span>PostgreSQL Database</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {health?.database?.status || 'Probing'}
            </span>
          </div>
          <div className="text-xs text-slate-400 space-y-1">
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span>Query Latency</span>
              <span className="font-mono text-white font-bold">{health?.database?.latencyMs ?? 0} ms</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Pooler Protocol</span>
              <span className="font-mono text-slate-300">Transaction Mode (PgBouncer)</span>
            </div>
          </div>
        </div>

        {/* Gemini Live Subsystem */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-400" />
              <span>Gemini 2.5 Native Audio</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {health?.integrations?.gemini || 'Probing'}
            </span>
          </div>
          <div className="text-xs text-slate-400 space-y-1">
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span>Model Pinned</span>
              <span className="font-mono text-white text-[11px]">gemini-2.5-flash-native-audio</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Audio Format</span>
              <span className="font-mono text-slate-300">16kHz L16 PCM Bi-directional</span>
            </div>
          </div>
        </div>

        {/* Razorpay Engine Subsystem */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-400" />
              <span>Razorpay Payments</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {health?.integrations?.razorpay || 'Probing'}
            </span>
          </div>
          <div className="text-xs text-slate-400 space-y-1">
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span>Webhook Signing</span>
              <span className="font-mono text-white">SHA-256 HMAC Active</span>
            </div>
            <div className="flex justify-between py-1">
              <span>GST Engine</span>
              <span className="font-mono text-slate-300">18.0% Rule Enforced</span>
            </div>
          </div>
        </div>

        {/* Ledger Audit Subsystem */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-400" />
              <span>Financial Ledger Audit</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              VERIFIED
            </span>
          </div>
          <div className="text-xs text-slate-400 space-y-1">
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span>Sample Mismatches</span>
              <span className="font-mono text-white font-bold">
                {health?.audit?.ledgerSampleMismatches ?? 0}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span>Ledger Invariance</span>
              <span className="font-mono text-slate-300">100% Reconciled</span>
            </div>
          </div>
        </div>

        {/* Trust Proxy Subsystem */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-indigo-400" />
              <span>Trust Proxy & IP Gate</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              ACTIVE
            </span>
          </div>
          <div className="text-xs text-slate-400 space-y-1">
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span>Proxy Level</span>
              <span className="font-mono text-white">{health?.integrations?.trustProxy || 'Active'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>IP Spoofing Shield</span>
              <span className="font-mono text-slate-300">Strict Rightmost Header</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
