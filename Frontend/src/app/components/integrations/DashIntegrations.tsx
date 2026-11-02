import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, CheckCircle2, XCircle, RefreshCw, LogIn, LogOut, Sliders } from 'lucide-react';
import { apiClient } from '../../api';

interface CalendarStatus {
  connected: boolean;
}

/**
 * DashIntegrations — Google Calendar only.
 *
 * All other integrations (Cal.com, Zapier, Make.com, Generic Webhook, Slack,
 * Google Sheets, HubSpot, Salesforce) were removed because the route they
 * relied on (/api/v2/integrations) was never mounted in the server, making
 * every request silently return 404.
 *
 * Google Calendar is the only supported integration and operates via the
 * fully mounted /api/v2/calendar route.
 */
export function DashIntegrations() {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/api/v2/calendar/status');
      if (res.data && typeof res.data.connected === 'boolean') {
        setStatus({ connected: res.data.connected });
      } else {
        setStatus({ connected: false });
      }
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleConnect = () => {
    // Opens the OAuth redirect flow — server generates the Google auth URL
    window.location.href = '/api/v2/calendar/auth';
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Google Calendar? Your AI agents will lose access to your calendar.')) return;
    try {
      setDisconnecting(true);
      await apiClient.delete('/api/v2/calendar/disconnect');
      setStatus({ connected: false });
    } catch {
      alert('Failed to disconnect Google Calendar. Please try again.');
    } finally {
      setDisconnecting(false);
    }
  };

  const connected = status?.connected ?? false;

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Integrations
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Connect Claritiy Voice to external services. Currently supported: Google Calendar.
          </p>
        </div>

        <button
          onClick={fetchStatus}
          disabled={loading}
          className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Google Calendar Card */}
      {loading ? (
        <div className="p-16 text-center text-xs text-slate-400">Checking integration status…</div>
      ) : (
        <div className="max-w-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Google Calendar</h3>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Calendar &amp; Scheduling</span>
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

              <p className="text-xs text-slate-500 leading-relaxed">
                {connected
                  ? 'Your Google Calendar is linked. AI agents can check your availability and schedule events during live calls.'
                  : 'Link your Google Calendar to allow AI agents to check your availability and schedule appointments automatically during calls.'}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              {connected ? (
                <>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    ✓ Calendar access active
                  </span>
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="text-xs text-rose-500 hover:text-rose-700 font-semibold disabled:opacity-50"
                  >
                    {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleConnect}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5" /> Connect Google Calendar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
