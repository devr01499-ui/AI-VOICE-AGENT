import React, { useEffect, useState } from "react";
import { fetchAnalyticsSummary } from "../../api";
import { Cpu, RefreshCw, Phone, Clock, Activity, BarChart2 } from "lucide-react";

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
      if (summary && summary.success) {
        setData(summary.data);
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
      <div className="bg-red-50/50 border border-red-200/60 rounded-xl p-6 text-center my-6">
        <p className="text-sm text-red-600 font-medium" style={{ fontFamily: "'Figtree', sans-serif" }}>
          {error || "An unexpected error occurred while compiling workspace analytics."}
        </p>
        <button
          onClick={() => loadData()}
          className="mt-4 px-4 py-2 bg-foreground text-background text-xs font-semibold rounded-lg hover:bg-foreground/90 transition-all"
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

  return (
    <div className="space-y-6">
      {/* Header and Refresh Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Figtree', sans-serif" }}>
            Operational Analytics
          </h2>
          <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Figtree', sans-serif" }}>
            Real-time call volume, duration metrics, and agent performance.
          </p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg bg-white text-xs font-medium hover:bg-muted/10 active:scale-95 transition-all shadow-sm"
          style={{ fontFamily: "'DM Mono', monospace" }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "REFRESHING..." : "SYNC NOW"}
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
            <div key={card.label} className="bg-white border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <p className="text-xs text-muted-foreground font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>
                  {card.label}
                </p>
                <Icon className="w-4 h-4 text-muted-foreground/60" />
              </div>
              <p className="text-3xl font-bold mb-1" style={{ fontFamily: "'Instrument Serif', serif" }}>
                {card.value}
              </p>
              <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Figtree', sans-serif" }}>
                {card.sub}
              </p>
            </div>
          );
        })}
      </div>

      {/* Call State Heatmap/Bar chart */}
      <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
        <p className="text-sm font-semibold mb-4" style={{ fontFamily: "'Figtree', sans-serif" }}>
          Call Termination Status Breakdown
        </p>
        <div className="space-y-4">
          {Object.entries(data.statusCodeBreakdown)
            .filter(([_, val]) => val > 0)
            .map(([status, count]) => {
              const pct = ((count / data.totalCalls) * 100).toFixed(1);
              return (
                <div key={status} className="flex items-center gap-3">
                  <span
                    className="text-xs font-semibold text-muted-foreground w-28 flex-shrink-0"
                    style={{ fontFamily: "'DM Mono', monospace" }}
                  >
                    {status.toUpperCase()}
                  </span>
                  <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full bg-foreground rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span
                    className="text-xs font-medium w-16 text-right"
                    style={{ fontFamily: "'DM Mono', monospace" }}
                  >
                    {count} ({pct}%)
                  </span>
                </div>
              );
            })}
          {Object.keys(data.statusCodeBreakdown).length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4" style={{ fontFamily: "'DM Mono', monospace" }}>
              NO TERMINATION DATA RECORDED YET.
            </p>
          )}
        </div>
      </div>

      {/* Recent Transacted Records */}
      <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
        <p className="text-sm font-semibold mb-4" style={{ fontFamily: "'Figtree', sans-serif" }}>
          Recent Call History Log
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
                <th className="pb-3 font-semibold">DATE & TIME</th>
                <th className="pb-3 font-semibold">STATUS</th>
                <th className="pb-3 font-semibold text-right">DURATION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.callsList.map((call, idx) => (
                <tr key={idx} className="hover:bg-muted/10 transition-colors">
                  <td className="py-3 text-xs text-foreground" style={{ fontFamily: "'Figtree', sans-serif" }}>
                    {new Date(call.createdAt).toLocaleString()}
                  </td>
                  <td className="py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        call.status === "completed"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : call.status === "failed"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                      style={{ fontFamily: "'DM Mono', monospace" }}
                    >
                      {call.status.toUpperCase()}
                    </span>
                  </td>
                  <td
                    className="py-3 text-xs text-right text-muted-foreground"
                    style={{ fontFamily: "'DM Mono', monospace" }}
                  >
                    {call.durationSeconds ? `${call.durationSeconds}s` : "0s"}
                  </td>
                </tr>
              ))}
              {data.callsList.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center py-6 text-xs text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
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
