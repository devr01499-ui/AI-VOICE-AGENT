import React, { useState, useEffect } from 'react';
import { Sliders, CheckCircle2, XCircle, Zap, MessageSquare, Globe, FileSpreadsheet, RefreshCw, Key, ExternalLink, X, Check, Play, AlertCircle } from 'lucide-react';
import { apiClient } from '../../api';

interface UserIntegration {
  id: string;
  userId: string;
  type: string;
  name: string;
  config: string; // JSON
  enabled: boolean;
  createdAt: string;
}

interface IntegrationApp {
  type: string;
  name: string;
  description: string;
  category: string;
  iconBg: string;
  icon: React.ElementType;
}

const AVAILABLE_APPS: IntegrationApp[] = [
  {
    type: 'slack',
    name: 'Slack Alerting',
    description: 'Post real-time call alerting notifications and operational incidents to a designated Slack channel.',
    category: 'Alerts & Messaging',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400',
    icon: MessageSquare,
  },
  {
    type: 'generic_webhook',
    name: 'Generic Outbound Webhook',
    description: 'Forward call events, post-call analysis, and transcripts to custom HTTP webhooks signed with HMAC-SHA256.',
    category: 'Developer & Webhooks',
    iconBg: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400',
    icon: Globe,
  },
  {
    type: 'zapier',
    name: 'Zapier / Make Workflow',
    description: 'Connect Claritiy Voice to 5,000+ apps. Automatically trigger Zaps when calls finish or transcripts complete.',
    category: 'Automation',
    iconBg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400',
    icon: Zap,
  },
  {
    type: 'google_sheets',
    name: 'Google Sheets / CRM Sync',
    description: 'Append call summaries, extracted fields, and contact information directly to Google Sheets or CRMs.',
    category: 'Data & CRM',
    iconBg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400',
    icon: FileSpreadsheet,
  },
];

export function DashIntegrations() {
  const [integrations, setIntegrations] = useState<UserIntegration[]>([]);
  const [loading, setLoading] = useState(true);

  // Configuration Modal State
  const [selectedApp, setSelectedApp] = useState<IntegrationApp | null>(null);
  const [formData, setFormData] = useState({
    webhookUrl: '',
    secret: '',
    channel: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/api/v2/integrations');
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setIntegrations(res.data.data);
      }
    } catch {
      setIntegrations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const openConfigModal = (app: IntegrationApp) => {
    setSelectedApp(app);
    setTestResult(null);

    const existing = integrations.find((i) => i.type === app.type);
    if (existing) {
      try {
        const parsed = JSON.parse(existing.config || '{}');
        setFormData({
          webhookUrl: parsed.webhookUrl || parsed.url || '',
          secret: parsed.secret || '',
          channel: parsed.channel || '',
        });
      } catch {
        setFormData({ webhookUrl: '', secret: '', channel: '' });
      }
    } else {
      setFormData({ webhookUrl: '', secret: '', channel: '' });
    }
  };

  const handleSaveIntegration = async () => {
    if (!selectedApp) return;
    if (!formData.webhookUrl.trim()) {
      alert('Webhook URL is required');
      return;
    }

    try {
      setSubmitting(true);
      const configObj = {
        webhookUrl: formData.webhookUrl.trim(),
        secret: formData.secret.trim() || undefined,
        channel: formData.channel.trim() || undefined,
      };

      await apiClient.post(`/api/v2/integrations/${selectedApp.type}`, {
        name: selectedApp.name,
        config: configObj,
        enabled: true,
      });

      fetchIntegrations();
      setSelectedApp(null);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save integration settings');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestIntegration = async () => {
    if (!selectedApp) return;
    try {
      setTestResult(null);
      const res = await apiClient.post(`/api/v2/integrations/${selectedApp.type}/test`);
      if (res.data?.success) {
        setTestResult({ success: true, message: res.data.message || 'Test delivery succeeded!' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.response?.data?.error || 'Test webhook delivery failed' });
    }
  };

  const handleDisconnect = async (type: string) => {
    if (!window.confirm('Are you sure you want to disconnect this integration?')) return;
    try {
      await apiClient.delete(`/api/v2/integrations/${type}`);
      fetchIntegrations();
      setSelectedApp(null);
    } catch {
      alert('Failed to disconnect integration');
    }
  };

  const getIntegrationForApp = (type: string) => {
    return integrations.find((i) => i.type === type && i.enabled);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Integrations Marketplace
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Connect Claritiy Voice to third-party notification channels, automation platforms, and CRMs.
          </p>
        </div>

        <button
          onClick={fetchIntegrations}
          className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Integrations
        </button>
      </div>

      {/* Grid of Integration Cards */}
      {loading ? (
        <div className="p-16 text-center text-xs text-slate-400">Loading third-party integrations marketplace...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {AVAILABLE_APPS.map((app) => {
            const connected = getIntegrationForApp(app.type);
            const Icon = app.icon;
            return (
              <div
                key={app.type}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl ${app.iconBg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">{app.name}</h3>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">{app.category}</span>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 ${
                        connected
                          ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {connected ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Connected
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 text-slate-400" /> Not Connected
                        </>
                      )}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">{app.description}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <button
                    onClick={() => openConfigModal(app)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                  >
                    {connected ? 'Manage Settings' : 'Connect'}
                  </button>

                  {connected && (
                    <button
                      onClick={() => handleDisconnect(app.type)}
                      className="text-xs text-rose-500 hover:text-rose-700 font-semibold"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Integration Configuration Modal */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" /> Configure {selectedApp.name}
              </h3>
              <button onClick={() => setSelectedApp(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                    testResult.success
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                      : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                  }`}
                >
                  {testResult.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Webhook Target URL <span className="text-rose-500">*</span>
                </label>
                <input
                  type="url"
                  placeholder={
                    selectedApp.type === 'slack'
                      ? 'https://hooks.slack.com/services/T00/B00/XXXX'
                      : 'https://your-server.com/api/webhooks'
                  }
                  value={formData.webhookUrl}
                  onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {selectedApp.type === 'slack' && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Channel Override (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="#voice-alerts"
                    value={formData.channel}
                    onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  HMAC Secret Key (Optional)
                </label>
                <input
                  type="text"
                  placeholder="whsec_..."
                  value={formData.secret}
                  onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between text-xs">
              {getIntegrationForApp(selectedApp.type) ? (
                <button
                  onClick={handleTestIntegration}
                  className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <Play className="w-3.5 h-3.5 text-indigo-500" /> Test Connection
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedApp(null)}
                  className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveIntegration}
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Save Connection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
