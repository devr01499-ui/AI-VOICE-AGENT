import React, { useState, useEffect, useRef } from 'react';
import { Radio, PhoneOff, PhoneForwarded, Volume2, Mic, Activity, Clock, ShieldAlert, RefreshCw, User, CheckCircle2, ChevronRight, X, AlertTriangle } from 'lucide-react';
import { apiClient, fetchLiveCalls, fetchAgents, getCallTranscript, getLiveTranscriptWsUrl, requestTranscriptTicket, type ApiCall, type ApiAgent } from '../../api';

interface LiveTranscriptMessage {
  turnId?: string;
  seq?: number;
  speaker: string;
  text: string;
  isFinal: boolean;
  timestamp: string;
}

/** Order by the sequence the turn STARTED (server assigns it), falling back to arrival order. */
function mergeSorted(list: LiveTranscriptMessage[]): LiveTranscriptMessage[] {
  return list
    .map((m, i) => ({ m, i }))
    .sort((a, b) => {
      const as = a.m.seq ?? Number.MAX_SAFE_INTEGER;
      const bs = b.m.seq ?? Number.MAX_SAFE_INTEGER;
      return as === bs ? a.i - b.i : as - bs;
    })
    .map((x) => x.m);
}

export function DashLiveMonitoring() {
  const [activeCalls, setActiveCalls] = useState<ApiCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<ApiCall | null>(null);
  const [agents, setAgents] = useState<ApiAgent[]>([]);
  const [batchFilter, setBatchFilter] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('live_monitoring_batch_id');
    } catch {
      return null;
    }
  });

  // Live WebSocket transcript state
  const [transcripts, setTranscripts] = useState<LiveTranscriptMessage[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [interveneSuccess, setInterveneSuccess] = useState<string | null>(null);
  const [transferNumber, setTransferNumber] = useState('');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const firstLoadRef = useRef(true);

  const fetchActiveCalls = async () => {
    try {
      // Only show the loading state on the very first load; later polls update silently (no flicker).
      if (firstLoadRef.current) setLoading(true);
      // The server returns ONLY calls that are really live (no leftovers from restarts/missed webhooks),
      // so "Active Sessions" can never show more than the calls actually running.
      const live = await fetchLiveCalls(batchFilter);
      setActiveCalls(live);

      // Keep the current selection while that call is still live; otherwise pick the first live call, or none.
      setSelectedCall((prev) => {
        if (prev) {
          const still = live.find((c) => c.id === prev.id);
          if (still) return prev.status === still.status ? prev : still;
        }
        return live.length > 0 ? live[0] : null;
      });
    } catch {
      // Keep what is on screen on a transient network error instead of wiping the list.
    } finally {
      firstLoadRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents().then(setAgents).catch(() => {});
    fetchActiveCalls();

    // Auto refresh active call list every 5 seconds
    const interval = setInterval(fetchActiveCalls, 5000);
    return () => clearInterval(interval);
  }, [batchFilter]);

  // Connect WebSocket when selectedCall changes
  useEffect(() => {
    if (!selectedCall) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsConnected(false);
      setTranscripts([]);
      return;
    }

    setTranscripts([]);
    setWsConnected(false);

    let isCancelled = false;

    // Backfill what was already said (so opening or switching to a call mid-conversation is not blank).
    getCallTranscript(selectedCall.id)
      .then((res) => {
        if (isCancelled || !res?.turns?.length) return;
        const past: LiveTranscriptMessage[] = res.turns.map((t) => ({
          turnId: `db_${t.id}`,
          seq: t.sequenceNumber,
          speaker: t.speaker === 'caller' ? 'user' : 'agent',
          text: t.text,
          isFinal: true,
          timestamp: '',
        }));
        setTranscripts((prev) => {
          // Live turns that already arrived win over the stored copy of the same turn (same seq + speaker).
          const have = new Set(prev.map((m) => `${m.seq}:${m.speaker}`));
          return mergeSorted([...past.filter((m) => !have.has(`${m.seq}:${m.speaker}`)), ...prev]);
        });
      })
      .catch(() => {});

    requestTranscriptTicket(selectedCall.id)
      .then((ticket) => {
        if (isCancelled) return;
        const wsUrl = getLiveTranscriptWsUrl(selectedCall.id, ticket);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isCancelled) setWsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.event === 'transcript') {
              const turnId = data.turnId;
              const speaker = data.speaker === 'caller' ? 'user' : (data.speaker || 'agent');
              setTranscripts((prev) => {
                const idx = prev.findIndex(
                  (t) => (turnId && t.turnId === turnId) || (data.seq != null && t.seq === data.seq && t.speaker === speaker)
                );
                if (idx !== -1) {
                  const updated = [...prev];
                  // A turn's text only ever grows while it is open; never replace it with something shorter/empty.
                  const nextText = data.text && data.text.length >= (updated[idx].text || '').length ? data.text : updated[idx].text;
                  updated[idx] = { ...updated[idx], turnId: turnId || updated[idx].turnId, text: nextText, isFinal: Boolean(data.isFinal) || updated[idx].isFinal };
                  return mergeSorted(updated);
                }
                return mergeSorted([
                  ...prev,
                  {
                    turnId: turnId || `turn_${Date.now()}_${Math.random()}`,
                    seq: data.seq,
                    speaker,
                    text: data.text || '',
                    isFinal: Boolean(data.isFinal),
                    timestamp: new Date().toLocaleTimeString(),
                  },
                ]);
              });
            }
          } catch {}
        };

        ws.onclose = () => {
          if (!isCancelled) setWsConnected(false);
        };

        ws.onerror = () => {
          if (!isCancelled) setWsConnected(false);
        };
      })
      .catch(() => {
        if (!isCancelled) setWsConnected(false);
      });

    return () => {
      isCancelled = true;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [selectedCall?.id]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  // Intervention: End Call
  const handleTerminateCall = async () => {
    if (!selectedCall) return;
    if (!window.confirm(`Are you sure you want to terminate live call ${selectedCall.id}?`)) return;

    try {
      setSubmittingAction(true);
      await apiClient.post(`/api/v2/calls/${selectedCall.id}/end`);
      setInterveneSuccess('Call terminated by supervisor intervention.');
      setActiveCalls((prev) => prev.filter((c) => c.id !== selectedCall.id));
      fetchActiveCalls();
    } catch {
      alert('Failed to terminate call.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Intervention: Force Transfer
  const handleForceTransfer = async () => {
    if (!selectedCall) return;
    if (!transferNumber.trim()) {
      alert('Please enter a valid transfer phone number');
      return;
    }

    try {
      setSubmittingAction(true);
      await apiClient.post(`/api/v2/calls/${selectedCall.id}/transfer`, {
        targetNumber: transferNumber.trim(),
      });
      setInterveneSuccess(`Call transfer to ${transferNumber} initiated.`);
      setShowTransferModal(false);
      fetchActiveCalls();
    } catch {
      alert('Failed to initiate transfer.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const getAgentName = (agentId?: string) => {
    if (!agentId) return 'AI Voice Agent';
    const found = agents.find((a) => a.id === agentId);
    return found ? found.name : 'AI Voice Agent';
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Bar Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-500 animate-pulse" /> Live Call Monitoring & Supervision
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time audio session streaming, live transcript inspection, and immediate supervisor intervention.
          </p>
        </div>

        <button
          onClick={fetchActiveCalls}
          className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Active Calls
        </button>
      </div>

      {interveneSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> {interveneSuccess}
          </span>
          <button onClick={() => setInterveneSuccess(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Grid: Active Call List + Live Stream Supervisor Window */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Active Call List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" /> Active Sessions ({activeCalls.length})
            </h3>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          </div>

          {batchFilter && (
            <div className="p-2.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold flex items-center justify-between text-indigo-700 dark:text-indigo-300">
              <span className="truncate pr-2">Campaign filter active</span>
              <button
                onClick={() => {
                  setBatchFilter(null);
                  try {
                    sessionStorage.removeItem('live_monitoring_batch_id');
                  } catch {}
                }}
                className="underline hover:no-underline text-xs flex-shrink-0"
              >
                Clear
              </button>
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Checking active sessions...</div>
          ) : activeCalls.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl">
              <Radio className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">No Active Calls</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                When outbound or inbound calls are in progress, they will appear here live.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {activeCalls.map((call) => {
                const isSelected = selectedCall?.id === call.id;
                return (
                  <div
                    key={call.id}
                    onClick={() => setSelectedCall(call)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 shadow-xs'
                        : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                        {call.contactNumber || call.recipientPhoneNumber}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {call.batchName && (
                          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold rounded-full truncate max-w-[100px]" title={call.batchName}>
                            {call.batchName}
                          </span>
                        )}
                        <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {call.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Agent: <strong>{getAgentName(call.agentId)}</strong></span>
                      <span className="font-mono">{new Date(call.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column (2 cols): Live Supervisor Workspace */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col min-h-[500px]">
          {!selectedCall ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                <Radio className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">Select an Active Call</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Select an active session from the left panel to inspect live transcripts and execute intervention controls.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col space-y-4">
              {/* Session Control Header */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 font-mono">
                      {selectedCall.contactNumber || selectedCall.recipientPhoneNumber}
                    </h3>
                    <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-[10px] uppercase font-mono">
                      {selectedCall.direction || selectedCall.callDirection}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Agent: <strong className="text-slate-800 dark:text-slate-200">{getAgentName(selectedCall.agentId)}</strong> | ID: <span className="font-mono">{selectedCall.id.slice(0, 8)}...</span>
                  </p>
                </div>

                {/* Supervisor Intervention Action Buttons */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setShowTransferModal(true)}
                    disabled={submittingAction}
                    className="flex-1 sm:flex-none px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <PhoneForwarded className="w-3.5 h-3.5" /> Force Transfer
                  </button>
                  <button
                    onClick={handleTerminateCall}
                    disabled={submittingAction}
                    className="flex-1 sm:flex-none px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <PhoneOff className="w-3.5 h-3.5" /> Terminate Call
                  </button>
                </div>
              </div>

              {/* Live WebSocket Transcript Window */}
              <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-950 text-slate-100 flex flex-col font-mono text-xs overflow-hidden min-h-[320px]">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1.5 font-sans font-semibold text-slate-300">
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> Live Transcript Stream
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] ${wsConnected ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'}`}>
                    {wsConnected ? 'WebSocket Connected' : 'Connecting Stream...'}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  {transcripts.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 italic font-sans">
                      Listening for speech events on session {selectedCall.id.slice(0, 8)}...
                    </div>
                  ) : (
                    transcripts.map((t, idx) => (
                      <div
                        key={t.turnId || idx}
                        className={`p-2.5 rounded-lg border text-xs leading-relaxed transition-all ${
                          t.speaker === 'agent' || t.speaker === 'assistant'
                            ? 'bg-indigo-950/50 border-indigo-800/60 text-indigo-200 ml-4'
                            : 'bg-slate-900 border-slate-800 text-slate-200 mr-4'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 font-sans">
                          <span className="font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                            {t.speaker === 'agent' || t.speaker === 'assistant' ? 'AI Agent' : 'Caller'}
                            {!t.isFinal && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                          </span>
                          <span>{t.timestamp}</span>
                        </div>
                        <p className="font-sans whitespace-pre-wrap">{t.text}</p>
                      </div>
                    ))
                  )}
                  <div ref={transcriptEndRef} />
                </div>
                <div className="pt-2 text-[10px] text-slate-500 border-t border-slate-800/50 font-sans text-center">
                  Live transcripts reflect acoustic transcription from Gemini native audio recognition.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Force Transfer Modal */}
      {showTransferModal && selectedCall && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <PhoneForwarded className="w-4 h-4 text-amber-500" /> Force Call Transfer
              </h3>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <p className="text-slate-500">
                Instantly redirect call <strong className="font-mono text-slate-800 dark:text-slate-200">{selectedCall.contactNumber || selectedCall.recipientPhoneNumber}</strong> to a human operator or PSTN target.
              </p>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Transfer Number / SIP Endpoint
                </label>
                <input
                  type="text"
                  placeholder="+1 (555) 123-4567"
                  value={transferNumber}
                  onChange={(e) => setTransferNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-end gap-2 text-xs">
              <button
                onClick={() => setShowTransferModal(false)}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleForceTransfer}
                disabled={submittingAction}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-xs flex items-center gap-1.5"
              >
                <PhoneForwarded className="w-3.5 h-3.5" /> Transfer Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
