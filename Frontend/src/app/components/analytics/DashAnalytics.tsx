import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Clock, DollarSign, PhoneCall, CheckCircle2, AlertCircle, Calendar, RefreshCw, Smile, Meh, Frown, ArrowUpRight, ArrowDownLeft, Filter } from 'lucide-react';
import { apiClient, fetchAgents, type ApiAgent } from '../../api';

interface AnalyticsSummary {
  totalCalls: number;
  completionRatePct: number;
  averageDurationSeconds: number;
  totalDurationMinutes: number;
  estimatedCostUsd: number;
  statusBreakdown: {
    completed: number;
    failed: number;
    noAnswer: number;
    busy: number;
    inProgress: number;
  };
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
    positivePct: number;
    neutralPct: number;
    negativePct: number;
  };
  directionSplit: {
    inbound: number;
    outbound: number;
    inboundPct: number;
    outboundPct: number;
  };
  volumeTrend: {
    date: string;
    total: number;
    completed: number;
    failed: number;
  }[];
}

export function DashAnalytics() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<string>('30'); // '7', '30', '90'
  const [agents, setAgents] = useState<ApiAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      const days = parseInt(dateRange, 10) || 30;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const params: any = { startDate };
      if (selectedAgent !== 'all') params.agentId = selectedAgent;

      const res = await apiClient.get('/api/v2/analytics/summary', { params });
      if (res.data?.success && res.data?.summary) {
        setSummary(res.data.summary);
      }
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents().then(setAgents).catch(() => {});
  }, []);

  useEffect(() => {
    loadAnalyticsData();
  }, [dateRange, selectedAgent]);

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainder = sec % 60;
    return `${mins}m ${remainder}s`;
  };

  // Find max volume in trend for SVG height scaling
  const maxTrendVol = summary?.volumeTrend
    ? Math.max(...summary.volumeTrend.map((v) => v.total), 1)
    : 1;

  return (
    <div className="space-y-6 font-sans">
      {/* Top Controls Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Operational Analytics & Trends
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time telemetry, call volume trends, completion rates, and AI sentiment analysis.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Agent Filter */}
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          >
            <option value="all">All Agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          {/* Date Range Selector Buttons */}
          <div className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl flex items-center text-xs font-semibold">
            {[
              { label: '7 Days', val: '7' },
              { label: '30 Days', val: '30' },
              { label: '90 Days', val: '90' },
            ].map((btn) => (
              <button
                key={btn.val}
                onClick={() => setDateRange(btn.val)}
                className={`px-3 py-1 rounded-lg transition-all ${
                  dateRange === btn.val
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <button
            onClick={loadAnalyticsData}
            className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs shadow-sm transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center text-xs text-slate-400">Loading real-time analytics data...</div>
      ) : !summary || summary.totalCalls === 0 ? (
        <div className="p-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
            <BarChart3 className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">No Analytics Available</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No voice call telemetry recorded for the selected date range and filter. Run a call to generate metrics!
          </p>
        </div>
      ) : (
        <>
          {/* Top 4 Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Total Calls</span>
                <PhoneCall className="w-4 h-4 text-indigo-600" />
              </div>
              <p className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
                {summary.totalCalls.toLocaleString()}
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                <span>Last {dateRange} Days Telemetry</span>
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Completion Rate</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
                {summary.completionRatePct}%
              </p>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${summary.completionRatePct}%` }}
                />
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Avg Call Duration</span>
                <Clock className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
                {formatSeconds(summary.averageDurationSeconds)}
              </p>
              <p className="text-[11px] text-slate-400 font-mono">
                {summary.totalDurationMinutes} Total Mins Streamed
              </p>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Estimated Spend</span>
                <DollarSign className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
                ${summary.estimatedCostUsd.toFixed(2)}
              </p>
              <p className="text-[11px] text-slate-400 font-mono">Based on $0.05/min rate</p>
            </div>
          </div>

          {/* Call Volume Trend Chart */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-600" /> Daily Call Volume Trend
                </h3>
                <p className="text-[11px] text-slate-500">Distribution of calls over the selected timeframe</p>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-indigo-600 inline-block" /> Total Volume
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" /> Completed
                </span>
              </div>
            </div>

            {/* Custom Bar Visualization */}
            <div className="h-44 pt-6 flex items-end justify-between gap-2 overflow-x-auto">
              {summary.volumeTrend.map((v) => {
                const heightPct = Math.max(12, Math.round((v.total / maxTrendVol) * 100));
                return (
                  <div key={v.date} className="flex-1 min-w-[20px] flex flex-col items-center gap-2 group relative">
                    {/* Tooltip */}
                    <div className="absolute -top-10 opacity-0 group-hover:opacity-100 bg-slate-800 text-white text-[10px] py-1 px-2 rounded font-mono pointer-events-none transition-opacity z-10 whitespace-nowrap shadow-md">
                      {v.date}: {v.total} calls ({v.completed} completed)
                    </div>

                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-lg overflow-hidden flex flex-col justify-end transition-all" style={{ height: `${heightPct}%` }}>
                      <div
                        className="bg-indigo-600 dark:bg-indigo-500 w-full transition-all"
                        style={{ height: `${(v.completed / Math.max(1, v.total)) * 100}%` }}
                      />
                    </div>

                    <span className="text-[9px] font-mono text-slate-400 rotate-45 sm:rotate-0 truncate">
                      {v.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Breakdown Grid: Sentiment & Direction Split */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sentiment Analysis Card */}
            <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Smile className="w-4 h-4 text-emerald-500" /> AI Sentiment Distribution
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <Smile className="w-3.5 h-3.5" /> Positive Sentiment
                    </span>
                    <span className="font-mono">{summary.sentimentBreakdown.positivePct}% ({summary.sentimentBreakdown.positive})</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all"
                      style={{ width: `${summary.sentimentBreakdown.positivePct}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                      <Meh className="w-3.5 h-3.5" /> Neutral Sentiment
                    </span>
                    <span className="font-mono">{summary.sentimentBreakdown.neutralPct}% ({summary.sentimentBreakdown.neutral})</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-500 h-full transition-all"
                      style={{ width: `${summary.sentimentBreakdown.neutralPct}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                      <Frown className="w-3.5 h-3.5" /> Negative Sentiment
                    </span>
                    <span className="font-mono">{summary.sentimentBreakdown.negativePct}% ({summary.sentimentBreakdown.negative})</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-500 h-full transition-all"
                      style={{ width: `${summary.sentimentBreakdown.negativePct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Inbound vs Outbound Split Card */}
            <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-indigo-600" /> Inbound vs Outbound Split
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                    <ArrowDownLeft className="w-3.5 h-3.5 text-blue-500" /> Inbound Calls
                  </div>
                  <p className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
                    {summary.directionSplit.inbound} ({summary.directionSplit.inboundPct}%)
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" /> Outbound Calls
                  </div>
                  <p className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
                    {summary.directionSplit.outbound} ({summary.directionSplit.outboundPct}%)
                  </p>
                </div>
              </div>

              {/* Status Breakdown Chips */}
              <div className="pt-2 flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-lg font-medium">
                  Completed: {summary.statusBreakdown.completed}
                </span>
                <span className="px-2.5 py-1 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 rounded-lg font-medium">
                  Failed: {summary.statusBreakdown.failed}
                </span>
                <span className="px-2.5 py-1 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 rounded-lg font-medium">
                  No Answer: {summary.statusBreakdown.noAnswer}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
