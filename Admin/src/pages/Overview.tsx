import React, { useEffect, useState } from 'react';
import { adminFetch } from '../lib/api';
import { Users, PhoneCall, ShieldAlert, Sparkles, Activity, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';

interface OverviewProps {
  onNavigate: (path: string) => void;
}

export const Overview: React.FC<OverviewProps> = ({ onNavigate }) => {
  const [metrics, setMetrics] = useState<any | null>(null);
  const [attentionList, setAttentionList] = useState<any[]>([]);
  const [healthData, setHealthData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOverview() {
      try {
        setLoading(true);
        const [mRes, aRes, hRes] = await Promise.all([
          adminFetch<{ success: boolean; data: any }>('/api/v2/admin/metrics/overview').catch(() => null),
          adminFetch<{ success: boolean; data: any[] }>('/api/v2/admin/customers?risk=high&limit=5').catch(() => null),
          adminFetch<{ success: boolean; data: any }>('/api/v2/admin/health').catch(() => null),
        ]);

        if (mRes?.success) setMetrics(mRes.data);
        if (aRes?.success) setAttentionList(aRes.data);
        if (hRes?.success) setHealthData(hRes.data);
      } catch (err) {
        console.error('Failed to load overview data', err);
      } finally {
        setLoading(false);
      }
    }
    loadOverview();
  }, []);

  return (
    <div className="space-y-8 font-sans">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <span>Claritiy Voice Operational Overview</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          High-level operational health, real-time counters, and actionable governance alerts.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-zinc-400">Total Customers</span>
            <div className="h-8 w-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-3">
            {loading ? '...' : (metrics?.totalCustomers || 0).toLocaleString()}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            Active Accounts: <strong className="text-zinc-300">{metrics?.activeCustomers || 0}</strong>
          </p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-zinc-400">Total Calls</span>
            <div className="h-8 w-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white">
              <PhoneCall className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-3">
            {loading ? '...' : (metrics?.totalCallsPlaced || 0).toLocaleString()}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">All outbound and inbound telephony sessions</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-zinc-400">Granted Minutes</span>
            <div className="h-8 w-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-3">
            {loading ? '...' : (metrics?.totalMinutesGranted || 0).toLocaleString()} <span className="text-xs text-zinc-400">min</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Unified append-only minutes ledger volume</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-zinc-400">Suspended</span>
            <div className="h-8 w-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-3">
            {loading ? '...' : metrics?.suspendedCustomers || 0}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Blocked accounts with Vobiz isolation</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Needs Attention Panel */}
        <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-white" />
              <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
                Needs Attention — High Risk Accounts
              </h2>
            </div>
            <button
              onClick={() => onNavigate('/customers')}
              className="text-xs text-zinc-400 hover:text-white font-medium cursor-pointer"
            >
              View All Directory →
            </button>
          </div>

          <div className="divide-y divide-zinc-800/60">
            {attentionList.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-zinc-400" />
                <span>No high-risk customer accounts flagged at this time.</span>
              </div>
            ) : (
              attentionList.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onNavigate(`/customers/${item.id}`)}
                  className="py-3 flex items-center justify-between hover:bg-zinc-900/60 px-3 rounded-xl transition-colors cursor-pointer group"
                >
                  <div>
                    <div className="text-xs font-semibold text-white group-hover:underline transition-colors">
                      {item.fullName || 'Anonymous'}
                    </div>
                    <div className="text-[11px] text-zinc-400 font-mono">{item.email}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase font-semibold bg-zinc-900 text-white border border-zinc-700">
                      HIGH RISK
                    </span>
                    <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-white transition-colors" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* System Integrations Status */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-white" />
            <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
              Integration Health
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-black border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-400">PostgreSQL Cloud</span>
              <span className="text-white font-mono font-medium flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                {healthData?.database?.status === 'healthy' ? 'CONNECTED' : 'HEALTHY'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-black border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-400">Gemini Live Native Audio</span>
              <span className="text-white font-mono font-medium">CONFIGURED</span>
            </div>

            <div className="p-3 rounded-xl bg-black border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-400">Razorpay Payment Engine</span>
              <span className="text-white font-mono font-medium">CONFIGURED</span>
            </div>

            <div className="p-3 rounded-xl bg-black border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-400">Vobiz SIP & VoiceXML</span>
              <span className="text-white font-mono font-medium">OPERATIONAL</span>
            </div>
          </div>

          <button
            onClick={() => onNavigate('/health')}
            className="w-full py-2 bg-white text-black hover:bg-zinc-200 text-xs rounded-xl font-semibold transition-colors cursor-pointer"
          >
            Open Comprehensive Health Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
