import React, { useEffect, useState } from 'react';
import { adminFetch } from '../lib/api';
import {
  Users, PhoneCall, ShieldAlert, Sparkles, Activity, AlertTriangle,
  ArrowRight, CheckCircle2, Bot, Megaphone, Clock, AlertCircle,
  TrendingUp, RefreshCw, Database, Info,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface OverviewProps {
  onNavigate: (path: string) => void;
}

export const Overview: React.FC<OverviewProps> = ({ onNavigate }) => {
  const [metrics, setMetrics] = useState<any | null>(null);
  const [attentionList, setAttentionList] = useState<any[]>([]);
  const [healthData, setHealthData] = useState<any | null>(null);
  const [dailyMetrics, setDailyMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const loadOverview = async () => {
    try {
      setLoading(true);
      setError(null);
      const [mRes, aRes, hRes, dRes] = await Promise.all([
        adminFetch<{ success: boolean; data: any }>('/api/v2/admin/metrics/overview').catch(() => null),
        adminFetch<{ success: boolean; data: any[] }>('/api/v2/admin/customers?risk=high&limit=5').catch(() => null),
        adminFetch<{ success: boolean; data: any }>('/api/v2/admin/health').catch(() => null),
        adminFetch<{ success: boolean; data: any[] }>('/api/v2/admin/metrics/daily').catch(() => null),
      ]);

      if (mRes?.success) setMetrics(mRes.data);
      if (aRes?.success) setAttentionList(aRes.data);
      if (hRes?.success) setHealthData(hRes.data);
      if (dRes?.success) setDailyMetrics(dRes.data || []);
      setLastRefreshed(new Date());
    } catch (err) {
      setError('Failed to load overview data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const kpiCards = [
    {
      label: 'Total Sign-ups',
      value: metrics?.totalCustomers ?? 0,
      sub: `${metrics?.activeCustomers ?? 0} active`,
      icon: Users,
    },
    {
      label: 'Suspended',
      value: metrics?.suspendedCustomers ?? 0,
      sub: `${metrics?.restrictedCustomers ?? 0} restricted`,
      icon: ShieldAlert,
    },
    {
      label: 'Total Agents',
      value: metrics?.totalAgents ?? 0,
      sub: 'across all accounts',
      icon: Bot,
    },
    {
      label: 'Total Campaigns',
      value: metrics?.totalCampaigns ?? 0,
      sub: 'batch dial campaigns',
      icon: Megaphone,
    },
    {
      label: 'Total Calls',
      value: metrics?.totalCallsPlaced ?? 0,
      sub: `${metrics?.callsByStatus?.completed ?? 0} completed`,
      icon: PhoneCall,
    },
    {
      label: 'Vobiz Minutes Used',
      value: metrics?.vobizMinutesUsed ?? 0,
      sub: 'internal ledger · call_usage',
      icon: Sparkles,
      suffix: 'min',
    },
    {
      label: 'Minutes Granted',
      value: metrics?.totalMinutesGranted ?? 0,
      sub: 'all credits ever issued',
      icon: TrendingUp,
      suffix: 'min',
    },
    {
      label: 'Gemini Token Usage',
      value: null,
      sub: 'Not tracked — see note below',
      icon: AlertCircle,
      unavailable: true,
    },
  ];

  const callStatusItems = [
    { label: 'Completed', value: metrics?.callsByStatus?.completed ?? 0, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { label: 'Failed / No Answer', value: metrics?.callsByStatus?.failed ?? 0, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
    { label: 'In Progress', value: metrics?.callsByStatus?.inProgress ?? 0, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', pulse: true },
    { label: 'Queued / Ringing', value: metrics?.callsByStatus?.queued ?? 0, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  ];

  const chartData = dailyMetrics.map((d) => ({
    date: d.date?.slice(5) ?? '', // MM-DD
    signups: d.newSignupsCount ?? 0,
    calls: d.callsDialedCount ?? 0,
  }));

  return (
    <div className="space-y-8 font-sans">
      {/* Page Title */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Claritiy Voice Operational Overview</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            High-level operational health, verified global totals, and actionable governance alerts.
          </p>
        </div>
        <button
          onClick={loadOverview}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 text-xs transition-colors cursor-pointer disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-900/20 border border-red-700/40 text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`bg-zinc-950 border ${card.unavailable ? 'border-zinc-700/50 opacity-70' : 'border-zinc-800'} rounded-2xl p-5 shadow-sm relative overflow-hidden`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-zinc-400">{card.label}</span>
                <div className="h-8 w-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              {card.unavailable ? (
                <>
                  <div className="text-lg font-bold font-mono text-zinc-500 mt-3">Unavailable</div>
                  <p className="text-[11px] text-zinc-600 mt-1">{card.sub}</p>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold font-mono text-white mt-3">
                    {loading ? '...' : (card.value ?? 0).toLocaleString()}
                    {card.suffix && <span className="text-xs text-zinc-400 ml-1">{card.suffix}</span>}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1">{card.sub}</p>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Call Status Breakdown */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <PhoneCall className="h-4 w-4 text-white" />
          <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider">Call Status Breakdown</h2>
          <span className="text-[10px] font-mono text-zinc-500 ml-auto">Source: internal DB · {loading ? '...' : 'live count'}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {callStatusItems.map((s) => (
            <div key={s.label} className={`border ${s.bg} rounded-xl p-3.5`}>
              <div className={`text-xl font-bold font-mono ${s.color} flex items-center gap-2`}>
                {loading ? '...' : s.value.toLocaleString()}
                {s.pulse && s.value > 0 && <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />}
              </div>
              <div className="text-[11px] text-zinc-400 mt-1 font-mono uppercase">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sign-up Trend Chart */}
      {chartData.length > 0 && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="h-4 w-4 text-white" />
            <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider">Sign-up & Call Trend (14 days)</h2>
            <span className="text-[10px] font-mono text-zinc-500 ml-auto">Source: DailyMetric table · IST</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#09090b', border: '1px solid #3f3f46', borderRadius: 12, fontSize: 11 }}
                labelStyle={{ color: '#a1a1aa' }}
                itemStyle={{ color: '#ffffff' }}
              />
              <Line type="monotone" dataKey="signups" stroke="#ffffff" strokeWidth={2} dot={false} name="New Sign-ups" />
              <Line type="monotone" dataKey="calls" stroke="#71717a" strokeWidth={1.5} dot={false} name="Calls Dialed" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

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
                <span>{loading ? 'Loading...' : 'No high-risk customer accounts flagged at this time.'}</span>
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
                <span className={`h-1.5 w-1.5 rounded-full ${healthData?.database?.status === 'healthy' ? 'bg-white animate-pulse' : 'bg-red-500'}`} />
                {healthData?.database?.status === 'healthy' ? 'CONNECTED' : (healthData?.database?.status || 'CHECKING')}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-black border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-400">Gemini Live Audio</span>
              <span className="text-zinc-500 font-mono font-medium text-[10px] uppercase">
                {healthData?.integrations?.gemini === 'configured' ? 'CONFIGURED' : 'KEY MISSING'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-black border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-400">Razorpay</span>
              <span className="text-zinc-500 font-mono font-medium text-[10px] uppercase">
                {healthData?.integrations?.razorpay === 'configured' ? 'CONFIGURED' : 'KEY MISSING'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-black border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-400">Vobiz SIP / VoiceXML</span>
              <span className="text-white font-mono font-medium text-[10px] uppercase">OPERATIONAL</span>
            </div>
          </div>

          <button
            onClick={() => onNavigate('/health')}
            className="w-full py-2 bg-white text-black hover:bg-zinc-200 text-xs rounded-xl font-semibold transition-colors cursor-pointer"
          >
            Open Health Dashboard
          </button>
        </div>
      </div>

      {/* Gemini Usage Notice */}
      <div className="bg-zinc-950 border border-amber-700/30 rounded-2xl p-5 shadow-sm flex items-start gap-3">
        <Info className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="text-xs font-semibold text-amber-300">Gemini Token Usage — Tracking Not Available</p>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Gemini Live API token counts are not currently persisted to the database.
            No <code className="bg-zinc-900 px-1 rounded text-zinc-300">GeminiTokenUsage</code> table exists in the schema.
            To enable this, an interceptor in <code className="bg-zinc-900 px-1 rounded text-zinc-300">GeminiLiveProvider</code> must log tokens per session.
            All Gemini token metrics will show as <strong className="text-white">Unavailable</strong> until this is implemented.
          </p>
        </div>
      </div>

      {/* Data Source Footer */}
      <div className="flex items-center gap-3 text-[11px] text-zinc-600 font-mono">
        <Database className="h-3.5 w-3.5" />
        <span>Data source: internal PostgreSQL database · Vobiz minutes from MinutesLedger (call_usage entries)</span>
        <span className="ml-auto flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Last refreshed: {lastRefreshed.toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};
