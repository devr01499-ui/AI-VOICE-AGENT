import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, CheckCircle2, XCircle, AlertTriangle, RefreshCw, LogIn, Sliders } from 'lucide-react';
import { apiClient } from '../../api';

interface CalendarStatus {
  connected: boolean;
  status?: 'healthy' | 'needs_reauth' | 'disconnected';
  lastCheckedAt?: string;
  message?: string;
}

/**
 * DashIntegrations — Google Calendar Integration Management.
 *
 * Provides single-click OAuth initiation via POST /api/v2/calendar/connect-url,
 * token revocation on disconnect, connection health tracking, and callback toast handling.
 */
export function DashIntegrations() {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/api/v2/calendar/status');
      if (res.data && typeof res.data.connected === 'boolean') {
        setStatus({
          connected: res.data.connected,
          status: res.data.status || (res.data.connected ? 'healthy' : 'disconnected'),
          lastCheckedAt: res.data.lastCheckedAt,
          message: res.data.message
        });
      } else {
        setStatus({ connected: false, status: 'disconnected' });
      }
    } catch {
      setStatus({ connected: false, status: 'disconnected' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    // Catch callback query params from OAuth redirection: ?calendar=connected or ?calendar=error&reason=...
    const urlParams = new URLSearchParams(window.location.search);
    const calendarParam = urlParams.get('calendar');
    if (calendarParam === 'connected') {
      setNotification({ type: 'success', message: 'Google Calendar successfully connected!' });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (calendarParam === 'error') {
      const reason = urlParams.get('reason') || 'unknown';
      setNotification({ type: 'error', message: `Google Calendar connection failed: ${reason}` });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [fetchStatus]);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const res = await apiClient.post('/api/v2/calendar/connect-url');
      if (res.data?.url) {
        window.location.assign(res.data.url);
      } else {
        alert('Failed to generate Google Calendar authorization link.');
      }
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to initiate Google Calendar connection.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Google Calendar? Your AI agents will lose access to check your availability and schedule appointments.')) {
      return;
    }
    try {
      setDisconnecting(true);
      await apiClient.delete('/api/v2/calendar/disconnect');
      setStatus({ connected: false, status: 'disconnected' });
      setNotification({ type: 'success', message: 'Google Calendar disconnected and access revoked.' });
    } catch {
      alert('Failed to disconnect Google Calendar. Please try again.');
    } finally {
      setDisconnecting(false);
    }
  };

  const connected = status?.connected ?? false;
  const isNeedsReauth = status?.status === 'needs_reauth';

  return (
    <div className="space-y-6 font-sans">
      {/* Notifications */}
      {notification && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
          }`}
        >
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="text-xs font-bold underline ml-4 hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

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
                      : isNeedsReauth
                      ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {connected ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Connected
                    </>
                  ) : isNeedsReauth ? (
                    <>
                      <AlertTriangle className="w-3 h-3 text-amber-500" /> Needs Reconnect
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
                  : isNeedsReauth
                  ? 'Your Google Calendar authorization has expired or was revoked. Please reconnect to restore AI scheduling.'
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
                  disabled={connecting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  {connecting ? 'Redirecting…' : isNeedsReauth ? 'Reconnect Calendar' : 'Connect Google Calendar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
