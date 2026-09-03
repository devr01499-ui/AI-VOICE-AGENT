import React, { useState, useEffect } from 'react';
import { Bell, Plus, Play, AlertCircle, AlertTriangle, CheckCircle2, Shield, RefreshCw, Key, Mail, Globe, Clock, Trash2, Edit3, X, Check } from 'lucide-react';
import { apiClient } from '../../api';

interface AlertRule {
  id: string;
  name: string;
  metric: string;
  comparator: string;
  thresholdValue: number;
  evaluationWindowMins: number;
  checkFrequencyMins: number;
  notificationEmail?: string;
  notificationWebhookUrl?: string;
  webhookSecret?: string;
  enabled: boolean;
  lastEvaluatedAt?: string;
  incidents?: AlertIncident[];
}

interface AlertIncident {
  id: string;
  ruleId: string;
  status: 'triggered' | 'active' | 'resolved' | string;
  triggerValue: number;
  summary: string;
  triggeredAt: string;
  resolvedAt?: string;
  rule?: {
    id: string;
    name: string;
    metric: string;
    thresholdValue: number;
  };
}

export function DashAlerting() {
  const [activeTab, setActiveTab] = useState<'rules' | 'incidents'>('rules');
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [incidents, setIncidents] = useState<AlertIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);

  // Create/Edit Rule Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    metric: 'call_volume',
    comparator: 'greater_than',
    thresholdValue: '100',
    evaluationWindowMins: '60',
    checkFrequencyMins: '5',
    notificationEmail: '',
    notificationWebhookUrl: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchAlertData = async () => {
    try {
      setLoading(true);
      const [rulesRes, incidentsRes] = await Promise.all([
        apiClient.get('/api/v2/alerting/rules'),
        apiClient.get('/api/v2/alerting/incidents'),
      ]);

      if (rulesRes.data?.success && Array.isArray(rulesRes.data?.data)) {
        setRules(rulesRes.data.data);
      }
      if (incidentsRes.data?.success && Array.isArray(incidentsRes.data?.data)) {
        setIncidents(incidentsRes.data.data);
      }
    } catch {
      setRules([]);
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlertData();
  }, []);

  const handleCreateRule = async () => {
    if (!formData.name.trim()) {
      alert('Rule name is required');
      return;
    }

    try {
      setSubmitting(true);
      await apiClient.post('/api/v2/alerting/rules', {
        name: formData.name.trim(),
        metric: formData.metric,
        comparator: formData.comparator,
        thresholdValue: parseFloat(formData.thresholdValue),
        evaluationWindowMins: parseInt(formData.evaluationWindowMins, 10),
        checkFrequencyMins: parseInt(formData.checkFrequencyMins, 10),
        notificationEmail: formData.notificationEmail.trim() || undefined,
        notificationWebhookUrl: formData.notificationWebhookUrl.trim() || undefined,
      });

      setIsModalOpen(false);
      setFormData({
        name: '',
        metric: 'call_volume',
        comparator: 'greater_than',
        thresholdValue: '100',
        evaluationWindowMins: '60',
        checkFrequencyMins: '5',
        notificationEmail: '',
        notificationWebhookUrl: '',
      });
      fetchAlertData();
    } catch {
      alert('Failed to create alert rule');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleRule = async (rule: AlertRule) => {
    try {
      await apiClient.put(`/api/v2/alerting/rules/${rule.id}`, {
        enabled: !rule.enabled,
      });
      fetchAlertData();
    } catch {
      alert('Failed to toggle rule');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!window.confirm('Are you sure you want to delete this alert rule?')) return;
    try {
      await apiClient.delete(`/api/v2/alerting/rules/${ruleId}`);
      fetchAlertData();
    } catch {
      alert('Failed to delete rule');
    }
  };

  const handleEvaluateNow = async () => {
    try {
      setEvaluating(true);
      await apiClient.post('/api/v2/alerting/evaluate-now');
      await fetchAlertData();
    } catch {
      alert('Failed to run manual alert evaluation pass');
    } finally {
      setEvaluating(false);
    }
  };

  const formatMetricName = (m: string) => {
    return {
      call_volume: 'Call Volume',
      error_rate: 'Error Rate (%)',
      success_rate: 'Success Rate (%)',
      cost: 'Total Spend ($)',
      sentiment_score: 'Positive Sentiment (%)',
    }[m] || m;
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Operational Alerting & Incident Lifecycle
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Rule-based threshold monitoring with incident management and HMAC-SHA256 signed webhooks (<code className="font-mono text-[10px]">X-Claritiy-Signature</code>).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleEvaluateNow}
            disabled={evaluating}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Play className={`w-3.5 h-3.5 text-indigo-600 ${evaluating ? 'animate-spin' : ''}`} /> Evaluate Now
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Create Alert Rule
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-6">
        <button
          onClick={() => setActiveTab('rules')}
          className={`pb-3 text-xs font-bold transition-all relative ${
            activeTab === 'rules'
              ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Configured Alert Rules ({rules.length})
        </button>

        <button
          onClick={() => setActiveTab('incidents')}
          className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-1.5 ${
            activeTab === 'incidents'
              ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Incident History ({incidents.length})
          {incidents.some((i) => i.status === 'triggered' || i.status === 'active') && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          )}
        </button>
      </div>

      {/* Tab Content: Rules */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading alert rules...</div>
          ) : rules.length === 0 ? (
            <div className="p-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
                <Bell className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">No Alert Rules Configured</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                Define rules to monitor error rates, call volume spikes, or sentiment drops and send signed webhooks.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Create First Alert Rule
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`p-5 rounded-2xl border transition-all space-y-3 ${
                    rule.enabled
                      ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                      : 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-65'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        {rule.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                        Metric: <strong className="text-slate-700 dark:text-slate-300">{formatMetricName(rule.metric)}</strong>
                      </p>
                    </div>

                    <button
                      onClick={() => handleToggleRule(rule)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                        rule.enabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          rule.enabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1 text-xs font-mono">
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span>Condition:</span>
                      <strong className="text-indigo-600 dark:text-indigo-400 uppercase">
                        {rule.comparator.replace('_', ' ')} {rule.thresholdValue}
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-500 text-[11px]">
                      <span>Window / Freq:</span>
                      <span>{rule.evaluationWindowMins}m window / {rule.checkFrequencyMins}m check</span>
                    </div>
                  </div>

                  {rule.webhookSecret && (
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md overflow-x-auto">
                      <Key className="w-3 h-3 text-amber-500 flex-shrink-0" />
                      <span className="truncate">Secret: {rule.webhookSecret}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      {rule.notificationEmail && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> Email</span>}
                      {rule.notificationWebhookUrl && <span className="flex items-center gap-1"><Globe className="w-3 h-3 text-indigo-500" /> Webhook</span>}
                    </div>

                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="text-slate-400 hover:text-rose-600 transition-colors"
                      title="Delete Rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Incidents History */}
      {activeTab === 'incidents' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          {incidents.length === 0 ? (
            <div className="p-16 text-center text-xs text-slate-400">
              No alert incidents recorded yet. Incidents will trigger automatically when metrics breach configured thresholds.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Alert Rule</th>
                    <th className="py-3 px-4">Trigger Value</th>
                    <th className="py-3 px-4">Incident Summary</th>
                    <th className="py-3 px-4">Triggered At</th>
                    <th className="py-3 px-4">Resolved At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
                  {incidents.map((inc) => (
                    <tr key={inc.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            inc.status === 'triggered'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 animate-pulse'
                              : inc.status === 'active'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              inc.status === 'triggered'
                                ? 'bg-rose-500'
                                : inc.status === 'active'
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                          />
                          {inc.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans font-bold text-slate-800 dark:text-slate-200">
                        {inc.rule?.name || 'Alert Rule'}
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-600 dark:text-rose-400">
                        {inc.triggerValue}
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-600 dark:text-slate-300 max-w-xs truncate">
                        {inc.summary}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(inc.triggeredAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {inc.resolvedAt ? new Date(inc.resolvedAt).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Alert Rule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Bell className="w-4 h-4 text-indigo-600" /> Create Alert Rule
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Rule Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. High Error Rate Alert (>15%)"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Metric</label>
                  <select
                    value={formData.metric}
                    onChange={(e) => setFormData({ ...formData, metric: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="call_volume">Call Volume</option>
                    <option value="error_rate">Error Rate (%)</option>
                    <option value="success_rate">Success Rate (%)</option>
                    <option value="cost">Total Spend ($)</option>
                    <option value="sentiment_score">Positive Sentiment (%)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Comparator</label>
                  <select
                    value={formData.comparator}
                    onChange={(e) => setFormData({ ...formData, comparator: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="greater_than">Greater Than (&gt;)</option>
                    <option value="less_than">Less Than (&lt;)</option>
                    <option value="equals">Equals (=)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Threshold Value</label>
                <input
                  type="number"
                  placeholder="100"
                  value={formData.thresholdValue}
                  onChange={(e) => setFormData({ ...formData, thresholdValue: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Evaluation Window</label>
                  <select
                    value={formData.evaluationWindowMins}
                    onChange={(e) => setFormData({ ...formData, evaluationWindowMins: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="15">Last 15 Minutes</option>
                    <option value="30">Last 30 Minutes</option>
                    <option value="60">Last 1 Hour</option>
                    <option value="1440">Last 24 Hours</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Check Frequency</label>
                  <select
                    value={formData.checkFrequencyMins}
                    onChange={(e) => setFormData({ ...formData, checkFrequencyMins: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="1">Every 1 Minute</option>
                    <option value="5">Every 5 Minutes</option>
                    <option value="15">Every 15 Minutes</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notification Webhook URL (Signed with HMAC)
                </label>
                <input
                  type="url"
                  placeholder="https://your-server.com/webhooks/alerts"
                  value={formData.notificationWebhookUrl}
                  onChange={(e) => setFormData({ ...formData, notificationWebhookUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-[11px]"
                />
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
                onClick={handleCreateRule}
                disabled={submitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Save Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
