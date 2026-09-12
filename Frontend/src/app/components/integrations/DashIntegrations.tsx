import React, { useState, useEffect } from 'react';
import { Sliders, CheckCircle2, XCircle, Zap, MessageSquare, Globe, FileSpreadsheet, RefreshCw, Key, ExternalLink, X, Check, Play, AlertCircle, Calendar, Database, Layers, ShieldCheck } from 'lucide-react';
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
    type: 'calcom',
    name: 'Cal.com Booking',
    description: 'Direct self-serve API calendar integration. Enable AI voice agents to check real-time availability and schedule meetings live during calls.',
    category: 'Calendar & Scheduling',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400',
    icon: Calendar,
  },
  {
    type: 'zapier',
    name: 'Zapier Workflow',
    description: 'Connect Claritiy Voice to 5,000+ apps. Trigger automated Zaps when calls terminate, contacts qualify, or transcripts complete.',
    category: 'Automation',
    iconBg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400',
    icon: Zap,
  },
  {
    type: 'make',
    name: 'Make.com Scenario',
    description: 'Build visual automation scenarios. Stream post-call lead analytics, sentiment scores, and record audio URLs to custom Make workflows.',
    category: 'Automation',
    iconBg: 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400',
    icon: Layers,
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
    type: 'slack',
    name: 'Slack Alerting',
    description: 'Post real-time call alerting notifications and operational incidents to a designated Slack channel.',
    category: 'Alerts & Messaging',
    iconBg: 'bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400',
    icon: MessageSquare,
  },
  {
    type: 'google_sheets',
    name: 'Google Sheets / CRM Sync',
    description: 'Append call summaries, extracted fields, and contact information directly to Google Sheets or CRMs.',
    category: 'Data & CRM',
    iconBg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400',
    icon: FileSpreadsheet,
  },
  {
    type: 'hubspot',
    name: 'HubSpot CRM (OAuth App)',
    description: 'Requires registering a HubSpot Developer App on HubSpot App Marketplace with OAuth Client credentials and CRM object scope permissions.',
    category: 'CRM & Enterprise',
    iconBg: 'bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400',
    icon: Database,
  },
  {
    type: 'salesforce',
    name: 'Salesforce CRM (Connected App)',
    description: 'Requires setting up a Salesforce Connected App with Consumer Key/Secret, PKCE web server flow, and Salesforce instance domain mapping.',
    category: 'CRM & Enterprise',
    iconBg: 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400',
    icon: ShieldCheck,
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
    apiKey: '',
    eventSlug: '',
    clientId: '',
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
          apiKey: parsed.apiKey || parsed.api_key || '',
          eventSlug: parsed.eventSlug || parsed.event_slug || '',
          clientId: parsed.clientId || parsed.client_id || '',
        });
      } catch {
        setFormData({ webhookUrl: '', secret: '', channel: '', apiKey: '', eventSlug: '', clientId: '' });
      }
    } else {
      setFormData({ webhookUrl: '', secret: '', channel: '', apiKey: '', eventSlug: '', clientId: '' });
    }
  };

  const handleSaveIntegration = async () => {
    if (!selectedApp) return;

    if (selectedApp.type === 'calcom') {
      if (!formData.apiKey.trim() && !formData.webhookUrl.trim()) {
        alert('Cal.com API Key or Webhook URL is required');
        return;
      }
    } else if (selectedApp.type === 'hubspot' || selectedApp.type === 'salesforce') {
      if (!formData.clientId.trim()) {
        alert(`${selectedApp.name} Client ID is required`);
        return;
      }
    } else {
      if (!formData.webhookUrl.trim()) {
        alert('Webhook Target URL is required');
        return;
      }
    }

    try {
      setSubmitting(true);
      const configObj = {
        webhookUrl: formData.webhookUrl.trim() || undefined,
        secret: formData.secret.trim() || undefined,
        channel: formData.channel.trim() || undefined,
        apiKey: formData.apiKey.trim() || undefined,
        eventSlug: formData.eventSlug.trim() || undefined,
        clientId: formData.clientId.trim() || undefined,
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
      const res: any = await apiClient.post(`/api/v2/integrations/${selectedApp.type}/test`);
      if (res.data?.success) {
        setTestResult({ success: true, message: res.data.message || res.data.data?.message || 'Test delivery succeeded!' });
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

              {selectedApp.type === 'calcom' ? (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Cal.com API Key <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      placeholder="cal_live_..."
                      value={formData.apiKey}
                      onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Event Type Slug / ID (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="30min-demo"
                      value={formData.eventSlug}
                      onChange={(e) => setFormData({ ...formData, eventSlug: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Custom Booking Webhook (Optional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://api.cal.com/v1/bookings"
                      value={formData.webhookUrl}
                      onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </>
              ) : selectedApp.type === 'hubspot' || selectedApp.type === 'salesforce' ? (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {selectedApp.name} Client ID <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="OAuth2 Client ID..."
                      value={formData.clientId}
                      onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                    <strong>Enterprise App Requirement Notice:</strong> Direct integration with {selectedApp.name} requires an official Developer/Connected App registered on our provider side. Contact support or your account executive for dedicated app authorization.
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Webhook Target URL <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="url"
                      placeholder={
                        selectedApp.type === 'slack'
                          ? 'https://hooks.slack.com/services/T00/B00/XXXX'
                          : selectedApp.type === 'make'
                          ? 'https://hook.us1.make.com/xxxxxx'
                          : selectedApp.type === 'zapier'
                          ? 'https://hooks.zapier.com/hooks/catch/xxxxxx'
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
                </>
              )}
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
