import React, { useEffect, useState } from "react";
import { fetchAnalyticsSummary } from "../../api";
import { Cpu, RefreshCw, Phone, Clock, Activity, BarChart2 } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface AnalyticsData {
  totalMinutesUsed: number;
  averageCallDuration: number;
  statusCodeBreakdown: Record<string, number>;
  totalCalls: number;
  callsList: Array<{
    durationSeconds?: number;
    status: string;
    createdAt: string;
  }>;
}

export function AnalyticsOverview() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    try {
      const summary = await fetchAnalyticsSummary();
      if (summary) {
        setData(summary);
        setError(null);
      } else {
        setError("Failed to fetch call metrics");
      }
    } catch (err) {
      setError("Failed to retrieve dashboard analytics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin" />
        <p className="text-sm text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
          COMPILING DYNAMIC TELEPHONY METRICS...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="nm-card nm-state-error text-center my-6">
        <p className="text-sm font-bold" style={{ fontFamily: "'Figtree', sans-serif" }}>
          {error || "An unexpected error occurred while compiling workspace analytics."}
        </p>
        <button
          onClick={() => loadData()}
          className="mt-4 nm-button"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  // Calculate success rates
  const completed = data.statusCodeBreakdown.completed || 0;
  const failed = data.statusCodeBreakdown.failed || 0;
  const inProgress = data.statusCodeBreakdown.in_progress || 0;
  const successRate = data.totalCalls > 0 
    ? ((completed / data.totalCalls) * 100).toFixed(1)
    : "0.0";

  const volumeByHour: Record<string, number> = {};
  if (data && data.callsList) {
    data.callsList.forEach(call => {
      const d = new Date(call.createdAt);
      const hour = d.getHours();
      const hourStr = hour < 10 ? `0${hour}:00` : `${hour}:00`;
      volumeByHour[hourStr] = (volumeByHour[hourStr] || 0) + 1;
    });
  }

  const busiestHoursData = Object.keys(volumeByHour).sort().map(hour => ({
    hour,
    calls: volumeByHour[hour]
  }));

  const chartTheme = {
    fill: "var(--nm-accent, #3b82f6)",
    text: "var(--nm-text, #475569)",
    grid: "var(--nm-bg, #ECEDF0)",
  };

  return (
    <div className="space-y-6">
      {/* Header and Refresh Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--nm-text)]" style={{ fontFamily: "'Figtree', sans-serif" }}>
            Operational Analytics
          </h2>
          <p className="text-sm font-medium text-[var(--nm-text)]" style={{ fontFamily: "'Figtree', sans-serif" }}>
            Real-time call volume, duration metrics, and agent performance.
          </p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="nm-pill"
          style={{ fontFamily: "'DM Mono', monospace" }}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          <span className="font-bold">{refreshing ? "REFRESHING..." : "SYNC NOW"}</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: "MINUTES USED",
            value: `${data.totalMinutesUsed.toLocaleString()} m`,
            icon: Clock,
            sub: "Total aggregated talk time",
          },
          {
            label: "TOTAL CALLS",
            value: data.totalCalls.toLocaleString(),
            icon: Phone,
            sub: `${inProgress} active right now`,
          },
          {
            label: "AVG DURATION",
            value: `${data.averageCallDuration}s`,
            icon: Activity,
            sub: "Average transaction length",
          },
          {
            label: "COMPLETED RATE",
            value: `${successRate}%`,
            icon: BarChart2,
            sub: `${completed} calls completed`,
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="nm-card">
              <div className="flex justify-between items-start mb-3">
                <p className="text-xs font-bold text-[var(--nm-text)]" style={{ fontFamily: "'DM Mono', monospace" }}>
                  {card.label}
                </p>
                <Icon className="w-5 h-5 text-[var(--nm-text)]" />
              </div>
              <p className="text-4xl font-bold mb-2 text-[var(--nm-text)]" style={{ fontFamily: "'Instrument Serif', serif" }}>
                {card.value}
              </p>
              <p className="text-xs font-medium text-[var(--nm-text)]" style={{ fontFamily: "'Figtree', sans-serif" }}>
                {card.sub}
              </p>
            </div>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Call State Heatmap/Bar chart */}
        <div className="nm-card">
          <p className="text-base font-bold mb-6 text-[var(--nm-text)]" style={{ fontFamily: "'Figtree', sans-serif" }}>
            Call Termination Status Breakdown
          </p>
          <div className="space-y-5">
            {Object.entries(data.statusCodeBreakdown)
              .filter(([_, val]) => val > 0)
              .map(([status, count]) => {
                const pct = ((count / data.totalCalls) * 100).toFixed(1);
                return (
                  <div key={status} className="flex items-center gap-4">
                    <span
                      className="text-xs font-bold text-[var(--nm-text)] w-28 flex-shrink-0"
                      style={{ fontFamily: "'DM Mono', monospace" }}
                    >
                      {status.toUpperCase()}
                    </span>
                    <div className="flex-1 nm-slider-track">
                      <div
                        className="nm-slider-fill transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span
                      className="text-xs font-bold w-16 text-right text-[var(--nm-text)]"
                      style={{ fontFamily: "'DM Mono', monospace" }}
                    >
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            {Object.keys(data.statusCodeBreakdown).length === 0 && (
              <p className="text-sm font-bold text-[var(--nm-text)] text-center py-4" style={{ fontFamily: "'DM Mono', monospace" }}>
                NO TERMINATION DATA RECORDED YET.
              </p>
            )}
          </div>
        </div>

        {/* Busiest Hours Chart */}
        <div className="nm-card">
          <p className="text-base font-bold mb-6 text-[var(--nm-text)]" style={{ fontFamily: "'Figtree', sans-serif" }}>
            Busiest Hours (Recent 100 Calls)
          </p>
          <div className="h-64">
            {busiestHoursData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={busiestHoursData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartTheme.fill} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={chartTheme.fill} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTheme.text }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTheme.text }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', background: 'var(--nm-bg)', boxShadow: '6px 6px 12px var(--nm-shadow-drk), -6px -6px 12px var(--nm-shadow-lgt)' }}
                    itemStyle={{ color: chartTheme.text, fontSize: '12px', fontWeight: 'bold' }}
                    labelStyle={{ color: chartTheme.text, fontSize: '10px' }}
                  />
                  <Area type="monotone" dataKey="calls" stroke={chartTheme.fill} strokeWidth={2} fillOpacity={1} fill="url(#colorCalls)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm font-bold text-[var(--nm-text)] text-center py-4" style={{ fontFamily: "'DM Mono', monospace" }}>
                NO CALLS RECORDED YET.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Transacted Records */}
      <div className="nm-raised rounded-2xl overflow-hidden mt-6">
        <div className="px-6 py-5 border-b border-transparent">
          <p className="text-base font-bold text-[var(--nm-text)]" style={{ fontFamily: "'Figtree', sans-serif" }}>
            Recent Call History Log
          </p>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs font-bold text-[var(--nm-text)]" style={{ fontFamily: "'DM Mono', monospace" }}>
                <th className="pb-4 px-4">DATE & TIME</th>
                <th className="pb-4 px-4">STATUS</th>
                <th className="pb-4 px-4 text-right">DURATION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-transparent">
              {data.callsList.map((call, idx) => (
                <tr key={idx} className="hover:nm-pressed transition-all cursor-pointer">
                  <td className="py-4 px-4 text-sm font-bold text-[var(--nm-text)]" style={{ fontFamily: "'Figtree', sans-serif" }}>
                    {new Date(call.createdAt).toLocaleString()}
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                        call.status === "completed"
                          ? "nm-raised text-[var(--nm-accent)]"
                          : call.status === "failed"
                          ? "nm-raised nm-state-error"
                          : "nm-raised text-[var(--nm-warning)]"
                      }`}
                      style={{ fontFamily: "'DM Mono', monospace" }}
                    >
                      {call.status.toUpperCase()}
                    </span>
                  </td>
                  <td
                    className="py-4 px-4 text-sm font-bold text-right text-[var(--nm-text)]"
                    style={{ fontFamily: "'DM Mono', monospace" }}
                  >
                    {call.durationSeconds ? `${call.durationSeconds}s` : "0s"}
                  </td>
                </tr>
              ))}
              {data.callsList.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-sm font-bold text-[var(--nm-text)]" style={{ fontFamily: "'DM Mono', monospace" }}>
                    NO CALL RECORDS FOUND IN THIS WORKSPACE.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
