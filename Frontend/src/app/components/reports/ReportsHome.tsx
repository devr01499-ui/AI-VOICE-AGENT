import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Search, Filter, Download, RefreshCw, AlertTriangle,
  CheckCircle2, Clock, Phone, ChevronRight, Layers, ArrowUpRight,
  ShieldCheck, BarChart3, HelpCircle, Check, XCircle
} from 'lucide-react';
import {
  reportsApi,
  type ReportListItem,
  type ReportsSummary,
  fetchAgents,
  type ApiAgent
} from '../../api';
import { CallResultDrawer } from './CallResultDrawer';
import { BlueprintCatalogModal } from './BlueprintCatalogModal';

interface ReportsHomeProps {
  userRole?: string;
}

export function ReportsHome({ userRole = 'owner' }: ReportsHomeProps) {
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [agents, setAgents] = useState<ApiAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Filters
  const [searchPhone, setSearchPhone] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedLabel, setSelectedLabel] = useState<string>('all');
  const [onlyReviewNeeded, setOnlyReviewNeeded] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'all'>('30d');

  // Pagination & Drawer
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [showBlueprintsModal, setShowBlueprintsModal] = useState(false);

  const getDateFilterValues = () => {
    if (dateRange === 'all') return { dateFrom: undefined, dateTo: undefined };
    const now = new Date();
    let from = new Date();
    if (dateRange === 'today') {
      from.setHours(0, 0, 0, 0);
    } else if (dateRange === '7d') {
      from.setDate(now.getDate() - 7);
    } else if (dateRange === '30d') {
      from.setDate(now.getDate() - 30);
    }
    return {
      dateFrom: from.toISOString(),
      dateTo: now.toISOString(),
    };
  };

  const loadSummary = useCallback(async () => {
    try {
      setSummaryLoading(true);
      const { dateFrom, dateTo } = getDateFilterValues();
      const sum = await reportsApi.getSummary({
        dateFrom,
        dateTo,
        agentId: selectedAgentId !== 'all' ? selectedAgentId : undefined,
      });
      setSummary(sum);
    } catch (err) {
      console.error('[ReportsHome] Failed to load summary metrics:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, [dateRange, selectedAgentId]);

  const loadReports = useCallback(async (resetCursor = true) => {
    try {
      setLoading(true);
      const { dateFrom, dateTo } = getDateFilterValues();
      const currentCursor = resetCursor ? undefined : cursor;

      const res = await reportsApi.listReports({
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        label: selectedLabel !== 'all' ? selectedLabel : undefined,
        reviewNeeded: onlyReviewNeeded ? true : undefined,
        agentId: selectedAgentId !== 'all' ? selectedAgentId : undefined,
        dateFrom,
        dateTo,
        cursor: currentCursor,
        limit: 25,
      });

      if (resetCursor) {
        setReports(res.items || []);
      } else {
        setReports((prev) => [...prev, ...(res.items || [])]);
      }
      setCursor(res.nextCursor || undefined);
      setHasMore(res.hasMore);
    } catch (err) {
      console.error('[ReportsHome] Failed to load reports list:', err);
      if (resetCursor) setReports([]);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, selectedLabel, onlyReviewNeeded, selectedAgentId, dateRange, cursor]);

  useEffect(() => {
    fetchAgents().then(setAgents).catch(() => {});
  }, []);

  useEffect(() => {
    loadSummary();
    loadReports(true);
  }, [dateRange, selectedAgentId, selectedStatus, selectedLabel, onlyReviewNeeded]);

  const handleExportCsv = () => {
    const { dateFrom, dateTo } = getDateFilterValues();
    const url = reportsApi.getExportCsvUrl({
      dateFrom,
      dateTo,
      label: selectedLabel !== 'all' ? selectedLabel : undefined,
      reviewNeeded: onlyReviewNeeded ? true : undefined,
    });
    window.open(url, '_blank');
  };

  const formatSeconds = (sec?: number | null) => {
    if (!sec && sec !== 0) return '0s';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const getLabelBadgeStyle = (label: string) => {
    const l = (label || '').toUpperCase();
    if (l.includes('CONFIRM') || l.includes('BOOKED') || l.includes('QUALIFIED') || l.includes('PAID') || l.includes('RESOLVED')) {
      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    }
    if (l.includes('CANCEL') || l.includes('REJECT') || l.includes('NOT_INTERESTED') || l.includes('DISPUTE') || l.includes('ESCALAT')) {
      return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
    }
    if (l.includes('CALLBACK') || l.includes('RESCHEDULE') || l.includes('PENDING') || l.includes('PARTIAL')) {
      return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
    }
    return 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30';
  };

  // Filter reports locally if user is typing a phone number search query
  const displayedReports = reports.filter((r) => {
    if (!searchPhone) return true;
    const q = searchPhone.toLowerCase();
    const phone = (r.call?.recipientPhoneNumber || '').toLowerCase();
    const agent = (r.call?.agent?.name || '').toLowerCase();
    const lbl = (r.label || '').toLowerCase();
    return phone.includes(q) || agent.includes(q) || lbl.includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold font-sora text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            Call Results & Authoritative Reports
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Deterministic outcome labeling, verbatim-grounded field extraction, and audit trails for Indian business calls.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setShowBlueprintsModal(true)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold hover:border-slate-300 dark:hover:border-slate-600 transition-colors flex items-center gap-1.5"
          >
            <Layers className="w-4 h-4 text-indigo-500" />
            Blueprint Catalog (15)
          </button>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>

          <button
            onClick={() => {
              loadSummary();
              loadReports(true);
            }}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Refresh reports"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Analyzed Calls</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
            {summaryLoading ? '—' : summary?.analyzedCalls ?? 0}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Total calls with completed result engine
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Needs Review</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-amber-600 dark:text-amber-400">
            {summaryLoading ? '—' : summary?.needsReviewCount ?? 0}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Low confidence or conflicting facts flagged
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Average Score</span>
            <BarChart3 className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
            {summaryLoading ? '—' : `${summary?.avgScore ?? 0}/100`}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Deterministic mathematical rubric score
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Human Correction</span>
            <ShieldCheck className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
            {summaryLoading ? '—' : `${summary?.humanCorrectionRate ?? 0}%`}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Audited manual reviewer overrides
          </p>
        </div>
      </div>

      {/* Filter and Query Toolbar */}
      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[280px]">
          {/* Search box */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search phone number, agent, or label..."
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Status selector */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending Queue</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
          </select>

          {/* Agent filter */}
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold"
          >
            <option value="all">All Agents</option>
            {agents.map((ag) => (
              <option key={ag.id} value={ag.id}>{ag.name}</option>
            ))}
          </select>

          {/* Needs Review Toggle */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyReviewNeeded}
              onChange={(e) => setOnlyReviewNeeded(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-0"
            />
            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Needs Review
            </span>
          </label>
        </div>

        {/* Date presets */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setDateRange('today')}
            className={`px-2.5 py-1 rounded-lg transition-colors ${
              dateRange === 'today' ? 'bg-white dark:bg-slate-700 shadow-xs font-bold text-indigo-600 dark:text-indigo-300' : 'text-slate-500'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setDateRange('7d')}
            className={`px-2.5 py-1 rounded-lg transition-colors ${
              dateRange === '7d' ? 'bg-white dark:bg-slate-700 shadow-xs font-bold text-indigo-600 dark:text-indigo-300' : 'text-slate-500'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setDateRange('30d')}
            className={`px-2.5 py-1 rounded-lg transition-colors ${
              dateRange === '30d' ? 'bg-white dark:bg-slate-700 shadow-xs font-bold text-indigo-600 dark:text-indigo-300' : 'text-slate-500'
            }`}
          >
            30 Days
          </button>
          <button
            onClick={() => setDateRange('all')}
            className={`px-2.5 py-1 rounded-lg transition-colors ${
              dateRange === 'all' ? 'bg-white dark:bg-slate-700 shadow-xs font-bold text-indigo-600 dark:text-indigo-300' : 'text-slate-500'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Results Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Recipient & Agent</th>
                <th className="p-3.5">Blueprint</th>
                <th className="p-3.5">Outcome Label</th>
                <th className="p-3.5 text-center">Score</th>
                <th className="p-3.5 text-center">Confidence</th>
                <th className="p-3.5">Review Flag</th>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
              {loading && reports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                    Loading verified call reports...
                  </td>
                </tr>
              ) : displayedReports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                    <p className="font-semibold text-slate-600 dark:text-slate-400">No call reports match criteria.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Reports are automatically produced by the idempotent CallFinalizer engine as calls conclude.
                    </p>
                  </td>
                </tr>
              ) : (
                displayedReports.map((item) => {
                  const phone = item.call?.recipientPhoneNumber || 'N/A';
                  const agentName = item.call?.agent?.name || 'General Voice Agent';
                  const duration = formatSeconds(item.call?.durationSeconds);

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedCallId(item.callId)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      {/* Recipient & Agent */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{phone}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {agentName} • {duration}
                        </div>
                      </td>

                      {/* Blueprint */}
                      <td className="p-3.5">
                        <span className="font-medium text-slate-800 dark:text-slate-200 block truncate max-w-[180px]">
                          {item.blueprintName || item.blueprintId}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {item.blueprintId}
                        </span>
                      </td>

                      {/* Outcome Label */}
                      <td className="p-3.5">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg border text-[11px] font-bold font-mono tracking-tight ${getLabelBadgeStyle(
                            item.label
                          )}`}
                        >
                          {item.label}
                        </span>
                        {item.hasHumanCorrection && (
                          <span className="ml-1.5 text-[9px] font-semibold text-purple-600 dark:text-purple-400 uppercase">
                            (Audited)
                          </span>
                        )}
                      </td>

                      {/* Score */}
                      <td className="p-3.5 text-center font-mono font-bold">
                        {item.score !== null ? (
                          <span className={item.score >= 70 ? 'text-emerald-500' : 'text-amber-500'}>
                            {item.score}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Confidence */}
                      <td className="p-3.5 text-center font-mono text-slate-600 dark:text-slate-300">
                        {item.confidence !== null ? `${(item.confidence * 100).toFixed(0)}%` : '—'}
                      </td>

                      {/* Review Flag */}
                      <td className="p-3.5">
                        {item.reviewNeeded ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                            title={item.reviewReason || 'Flagged for human QA'}
                          >
                            <AlertTriangle className="w-3 h-3" /> Review
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Clear
                          </span>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>

                      {/* Action */}
                      <td className="p-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCallId(item.callId);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-300 font-semibold text-xs transition-colors inline-flex items-center gap-1"
                        >
                          Inspect <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Load More Pagination */}
        {hasMore && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-center bg-slate-50/50 dark:bg-slate-900/30">
            <button
              onClick={() => loadReports(false)}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading More...
                </>
              ) : (
                'Load More Reports'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Blueprint Catalog Modal */}
      <BlueprintCatalogModal
        isOpen={showBlueprintsModal}
        onClose={() => setShowBlueprintsModal(false)}
      />

      {/* Call Result Detail Drawer */}
      <CallResultDrawer
        callId={selectedCallId}
        onClose={() => setSelectedCallId(null)}
        onReportUpdated={() => {
          loadSummary();
          loadReports(true);
        }}
        userRole={userRole}
      />
    </div>
  );
}
