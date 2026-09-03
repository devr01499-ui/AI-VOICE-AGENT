import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Play, CheckCircle2, AlertTriangle, XCircle, Clock, Search, ChevronRight, X, RefreshCw, BarChart3, Sliders, AlertCircle, FileText } from 'lucide-react';
import { apiClient, fetchAgents, type ApiAgent } from '../../api';

interface QaCohort {
  id: string;
  name: string;
  description?: string;
  filterConfig: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | string;
  averageScore: number;
  passRatePct: number;
  totalScored: number;
  createdAt: string;
  _count?: { results: number };
}

interface CallQaResult {
  id: string;
  cohortId: string;
  callId: string;
  overallScore: number;
  passed: boolean;
  hallucinationFlag: boolean;
  resolutionFlag: boolean;
  latencyGapMs: number;
  flaggedIssues: string; // JSON
  evaluationSummary?: string;
  createdAt: string;
  call?: {
    id: string;
    recipientPhoneNumber: string;
    status: string;
    durationSeconds?: number;
    createdAt: string;
    agent?: { id: string; name: string };
  };
}

export function DashAIQualityAssurance() {
  const [cohorts, setCohorts] = useState<QaCohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<ApiAgent[]>([]);

  // Cohort Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    agentId: 'all',
    days: '30',
  });
  const [submitting, setSubmitting] = useState(false);

  // Selected Cohort & Evaluation Details
  const [selectedCohort, setSelectedCohort] = useState<QaCohort | null>(null);
  const [cohortDetails, setCohortDetails] = useState<{ cohort: QaCohort; results: CallQaResult[] } | null>(null);
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);

  const fetchCohortsList = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/api/v2/qa/cohorts');
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setCohorts(res.data.data);
      }
    } catch {
      setCohorts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents().then(setAgents).catch(() => {});
    fetchCohortsList();
  }, []);

  const loadCohortDetails = async (cohortId: string) => {
    try {
      const res = await apiClient.get(`/api/v2/qa/cohorts/${cohortId}`);
      if (res.data?.success && res.data?.data) {
        const c = res.data.data;
        setSelectedCohort(c);
        setCohortDetails({ cohort: c, results: c.results || [] });
      }
    } catch {
      setCohortDetails(null);
    }
  };

  const handleCreateCohort = async () => {
    if (!formData.name.trim()) {
      alert('Cohort name is required');
      return;
    }

    try {
      setSubmitting(true);
      const filterConfig = {
        agentId: formData.agentId,
        days: formData.days,
      };

      await apiClient.post('/api/v2/qa/cohorts', {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        filterConfig,
      });

      setIsModalOpen(false);
      setFormData({ name: '', description: '', agentId: 'all', days: '30' });
      fetchCohortsList();
    } catch {
      alert('Failed to create QA cohort');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunEvaluation = async (cohortId: string) => {
    try {
      setEvaluatingId(cohortId);
      await apiClient.post(`/api/v2/qa/cohorts/${cohortId}/evaluate`);
      await fetchCohortsList();
      if (selectedCohort?.id === cohortId) {
        await loadCohortDetails(cohortId);
      }
    } catch {
      alert('Failed to run QA evaluation pass');
    } finally {
      setEvaluatingId(null);
    }
  };

  const handleDeleteCohort = async (cohortId: string) => {
    if (!window.confirm('Are you sure you want to delete this QA cohort?')) return;
    try {
      await apiClient.delete(`/api/v2/qa/cohorts/${cohortId}`);
      if (selectedCohort?.id === cohortId) {
        setSelectedCohort(null);
        setCohortDetails(null);
      }
      fetchCohortsList();
    } catch {
      alert('Failed to delete QA cohort');
    }
  };

  const parseIssues = (jsonStr?: string): string[] => {
    if (!jsonStr) return [];
    try {
      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> AI Quality Assurance & Call Scoring
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated LLM quality scoring pass for hallucination checks, resolution rates, and response latency.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchCohortsList}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> New QA Cohort
          </button>
        </div>
      </div>

      {/* Cohorts Grid */}
      {loading ? (
        <div className="p-16 text-center text-xs text-slate-400">Loading QA cohorts...</div>
      ) : cohorts.length === 0 ? (
        <div className="p-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">No QA Cohorts Defined</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            Sample and evaluate call quality automatically against hallucination and resolution scorecards.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Define First QA Cohort
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {cohorts.map((cohort) => {
            const isEvaluating = evaluatingId === cohort.id;
            const isSelected = selectedCohort?.id === cohort.id;
            return (
              <div
                key={cohort.id}
                onClick={() => {
                  setSelectedCohort(cohort);
                  loadCohortDetails(cohort.id);
                }}
                className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                  isSelected
                    ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 shadow-sm'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">{cohort.name}</h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                        cohort.status === 'completed'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {cohort.status}
                    </span>
                  </div>
                  {cohort.description && <p className="text-xs text-slate-500 line-clamp-2">{cohort.description}</p>}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-center">
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Avg Score</span>
                    <span className="text-base font-bold font-mono text-slate-900 dark:text-slate-100">
                      {cohort.averageScore}/100
                    </span>
                  </div>

                  <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Pass Rate</span>
                    <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {cohort.passRatePct}%
                    </span>
                  </div>

                  <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Calls</span>
                    <span className="text-base font-bold font-mono text-slate-900 dark:text-slate-100">
                      {cohort.totalScored}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRunEvaluation(cohort.id);
                    }}
                    disabled={isEvaluating}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <Play className={`w-3.5 h-3.5 ${isEvaluating ? 'animate-spin' : ''}`} />
                    {isEvaluating ? 'Scoring...' : 'Run QA Pass'}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCohort(cohort.id);
                    }}
                    className="text-xs text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 font-semibold"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cohort Scored Call Breakdown Drawer */}
      {cohortDetails && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" /> Scored Call Results for Cohort: {cohortDetails.cohort.name}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pass Rate: <strong className="text-emerald-600">{cohortDetails.cohort.passRatePct}%</strong> | Average Quality Score: <strong className="text-slate-900 dark:text-slate-100">{cohortDetails.cohort.averageScore}/100</strong>
              </p>
            </div>
            <button onClick={() => setCohortDetails(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {cohortDetails.results.length === 0 ? (
            <div className="p-8 text-center text-slate-400 italic text-xs">
              No call evaluation records found. Click "Run QA Pass" to sample and score call quality!
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {cohortDetails.results.map((res) => {
                const issues = parseIssues(res.flaggedIssues);
                return (
                  <div
                    key={res.id}
                    className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl space-y-2 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-mono">
                        <span
                          className={`px-2.5 py-1 rounded-lg font-bold text-xs ${
                            res.overallScore >= 80
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : res.overallScore >= 60
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                              : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                          }`}
                        >
                          Score: {res.overallScore}/100
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {res.call?.recipientPhoneNumber || 'Unknown Number'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px]">
                        <span className={`px-2 py-0.5 rounded font-semibold ${res.hallucinationFlag ? 'bg-rose-100 dark:bg-rose-950 text-rose-700' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700'}`}>
                          {res.hallucinationFlag ? 'Hallucination Detected' : 'No Hallucinations'}
                        </span>

                        <span className={`px-2 py-0.5 rounded font-semibold ${res.resolutionFlag ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700' : 'bg-rose-100 dark:bg-rose-950 text-rose-700'}`}>
                          {res.resolutionFlag ? 'Resolved' : 'Unresolved'}
                        </span>
                      </div>
                    </div>

                    {res.evaluationSummary && (
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-sans">{res.evaluationSummary}</p>
                    )}

                    {issues.length > 0 && (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 space-y-1">
                        <span className="font-bold text-rose-600 dark:text-rose-400 block text-[11px]">Flagged Quality Issues:</span>
                        <ul className="list-disc list-inside text-slate-500 space-y-0.5 pl-1">
                          {issues.map((issue, idx) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* New QA Cohort Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" /> Create QA Cohort
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Cohort Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Weekly Inbound Support Quality Audit"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Sampling criteria or audit notes..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Agent Filter</label>
                <select
                  value={formData.agentId}
                  onChange={(e) => setFormData({ ...formData, agentId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Agents</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Sample Timeframe</label>
                <select
                  value={formData.days}
                  onChange={(e) => setFormData({ ...formData, days: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="7">Last 7 Days</option>
                  <option value="30">Last 30 Days</option>
                  <option value="90">Last 90 Days</option>
                </select>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-end gap-2 text-xs">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCohort}
                disabled={submitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Create Cohort
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
