import React, { useState, useEffect, useRef } from 'react';
import { 
  PhoneCall, 
  PhoneIncoming, 
  PhoneOutgoing, 
  PhoneOff, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Radio, 
  Activity, 
  Mic, 
  Disc, 
  ExternalLink, 
  RotateCcw,
  Sparkles,
  Bot
} from 'lucide-react';
import { 
  initiateCall, 
  terminateCall, 
  fetchCalls, 
  fetchAgents, 
  getLiveTranscriptWsUrl, 
  type ApiCall, 
  type ApiAgent 
} from '../../api';
import { apiClient } from '../../api';

interface RealCallModalProps {
  open: boolean;
  onClose: () => void;
  initialAgentId?: string;
  initialFromNumber?: string;
  onNavigateToLiveMonitoring?: (callId?: string) => void;
}

interface TranscriptItem {
  speaker: string;
  text: string;
  timestamp: string;
}

export function RealCallModal({
  open,
  onClose,
  initialAgentId,
  initialFromNumber,
  onNavigateToLiveMonitoring,
}: RealCallModalProps) {
  // Mode: 'outbound' | 'inbound'
  const [activeTab, setActiveTab] = useState<'outbound' | 'inbound'>('outbound');

  // Form Fields
  const [toPhoneNumber, setToPhoneNumber] = useState('');
  const [selectedFromNumber, setSelectedFromNumber] = useState(initialFromNumber || '');
  const [selectedAgentId, setSelectedAgentId] = useState(initialAgentId || '');
  const [recordCall, setRecordCall] = useState(true);

  // Data
  const [availableNumbers, setAvailableNumbers] = useState<any[]>([]);
  const [availableAgents, setAvailableAgents] = useState<ApiAgent[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(false);

  // Active Call State
  const [inCall, setInCall] = useState(false);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<string>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Inbound Radar State
  const [inboundListening, setInboundListening] = useState(false);

  // Live Transcripts
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<any>(null);
  const radarRef = useRef<any>(null);

  // Load active numbers and agents on open
  useEffect(() => {
    if (!open) return;

    setLoadingInitial(true);
    setErrorMessage(null);

    Promise.all([
      apiClient.get('/api/v2/numbers').catch(() => ({ data: { data: [] } })),
      fetchAgents().catch(() => []),
    ]).then(([numRes, ags]) => {
      const nums = (numRes.data?.data || []).filter((n: any) => n.status === 'active');
      setAvailableNumbers(nums);
      setAvailableAgents(ags);

      // Pre-select from number if specified or default to first
      if (initialFromNumber) {
        setSelectedFromNumber(initialFromNumber);
      } else if (nums.length > 0 && !selectedFromNumber) {
        setSelectedFromNumber(nums[0].phoneNumber);
      }

      // Pre-select agent if specified or default to first
      if (initialAgentId) {
        setSelectedAgentId(initialAgentId);
      } else if (ags.length > 0 && !selectedAgentId) {
        setSelectedAgentId(ags[0].id);
      }
    }).finally(() => {
      setLoadingInitial(false);
    });
  }, [open, initialAgentId, initialFromNumber]);

  // Sync props when changed externally
  useEffect(() => {
    if (initialAgentId) setSelectedAgentId(initialAgentId);
  }, [initialAgentId]);

  useEffect(() => {
    if (initialFromNumber) setSelectedFromNumber(initialFromNumber);
  }, [initialFromNumber]);

  // Auto scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  // Call timer management
  useEffect(() => {
    if (inCall && (callStatus === 'in_progress' || callStatus === 'ringing')) {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [inCall, callStatus]);

  // Live WebSocket Transcript Connection
  useEffect(() => {
    if (!activeCallId || !inCall) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    const wsUrl = getLiveTranscriptWsUrl(activeCallId);
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'transcript' && data.text) {
            setTranscripts((prev) => [
              ...prev,
              {
                speaker: data.speaker || 'agent',
                text: data.text,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              },
            ]);
          }
        } catch {}
      };
    } catch {}

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [activeCallId, inCall]);

  // Inbound Call Radar: Poll for incoming calls on selected number
  useEffect(() => {
    if (!open || inCall || activeTab !== 'inbound') {
      if (radarRef.current) clearInterval(radarRef.current);
      setInboundListening(false);
      return;
    }

    setInboundListening(true);
    const targetDigits = (selectedFromNumber || '').replace(/\D/g, '');

    radarRef.current = setInterval(async () => {
      try {
        const calls = await fetchCalls({ limit: 10 });
        const matchingIncoming = calls.find((c) => {
          const toDigits = (c.phoneNumber || c.recipientPhoneNumber || '').replace(/\D/g, '');
          const isTargetNumber = targetDigits ? toDigits.includes(targetDigits) : true;
          return isTargetNumber && (c.status === 'in_progress' || c.status === 'ringing');
        });

        if (matchingIncoming) {
          // Detected real inbound call!
          setActiveCallId(matchingIncoming.id);
          setCallStatus(matchingIncoming.status);
          setInCall(true);
          setInboundListening(false);
          if (radarRef.current) clearInterval(radarRef.current);
        }
      } catch {}
    }, 2000);

    return () => {
      if (radarRef.current) clearInterval(radarRef.current);
    };
  }, [open, inCall, activeTab, selectedFromNumber]);

  // Outbound Call Trigger
  const handleInitiateOutboundCall = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanTo = toPhoneNumber.trim();
    if (!cleanTo || cleanTo.length < 8) {
      setErrorMessage('Please enter a valid destination phone number (e.g. +91 98765 43210).');
      return;
    }

    if (!selectedAgentId) {
      setErrorMessage('Please select an agent to conduct the call.');
      return;
    }

    try {
      setConnecting(true);
      const res = await initiateCall({
        phoneNumber: cleanTo.startsWith('+') ? cleanTo : `+${cleanTo}`,
        agentId: selectedAgentId,
        fromPhoneNumber: selectedFromNumber || undefined,
        record: recordCall,
      });

      if (res && res.id) {
        setActiveCallId(res.id);
        setCallStatus('ringing');
        setInCall(true);
        setCallDuration(0);
        setTranscripts([]);
      } else {
        throw new Error('Call initiation returned invalid session.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to initiate outbound call. Please check your caller ID and balance.');
    } finally {
      setConnecting(false);
    }
  };

  // Hangup Active Call
  const handleTerminateCall = async () => {
    if (!activeCallId) return;
    try {
      await terminateCall(activeCallId);
      setCallStatus('completed');
    } catch (err: any) {
      setErrorMessage('Failed to terminate call: ' + (err?.message || String(err)));
    }
  };

  // Reset to Place Another Call
  const handleReset = () => {
    setInCall(false);
    setActiveCallId(null);
    setCallStatus('idle');
    setCallDuration(0);
    setTranscripts([]);
    setErrorMessage(null);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!open) return null;

  const currentAgent = availableAgents.find((a) => a.id === selectedAgentId);
  const currentNumberObj = availableNumbers.find((n) => n.phoneNumber === selectedFromNumber);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
      <div 
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        style={{ fontFamily: "'Outfit', sans-serif" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white" style={{ fontFamily: "'Clash Display', 'Outfit', sans-serif" }}>
                Real-Time Telephony Call Testing
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Test real audio calls on active carrier lines with live AI speech.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector (only when not in active call) */}
        {!inCall && (
          <div className="px-6 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800 flex gap-2">
            <button
              onClick={() => { setActiveTab('outbound'); setErrorMessage(null); }}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'outbound'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <PhoneOutgoing className="w-4 h-4" />
              <span>1. Outbound Call (System Calls You)</span>
            </button>
            <button
              onClick={() => { setActiveTab('inbound'); setErrorMessage(null); }}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'inbound'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <PhoneIncoming className="w-4 h-4" />
              <span>2. Inbound Call (You Call Agent)</span>
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 rounded-xl text-xs font-semibold flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ACTIVE CALL MONITOR SCREEN */}
          {inCall ? (
            <div className="space-y-5 animate-fadeIn">
              {/* Call Status Ribbon */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4 shadow-lg border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className={`w-3.5 h-3.5 rounded-full ${callStatus === 'in_progress' ? 'bg-emerald-500 animate-pulse' : callStatus === 'ringing' ? 'bg-amber-400 animate-ping' : 'bg-slate-500'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Status:</span>
                      <span className="text-sm font-extrabold capitalize text-emerald-400">
                        {callStatus === 'in_progress' ? 'Live Connected' : callStatus === 'ringing' ? 'Ringing Phone...' : callStatus}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">
                      {activeTab === 'outbound' ? `Dialing: ${toPhoneNumber}` : `Receiving on: ${selectedFromNumber}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Duration */}
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Duration</span>
                    <span className="text-lg font-mono font-bold text-white">{formatSeconds(callDuration)}</span>
                  </div>

                  {/* Recording indicator */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold">
                    <span className={`w-2 h-2 rounded-full ${recordCall ? 'bg-rose-500 animate-pulse' : 'bg-slate-400'}`} />
                    <span className="text-[10px] text-slate-300">{recordCall ? 'Recording' : 'No Rec'}</span>
                  </div>
                </div>
              </div>

              {/* Agent & Carrier Pill Info */}
              <div className="grid grid-cols-2 gap-3 text-xs font-medium">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">AI Agent</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-emerald-600" />
                    {currentAgent?.name || 'Voice Assistant'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Caller ID Line</span>
                  <span className="font-bold font-mono text-slate-800 dark:text-slate-200 mt-0.5 block">
                    {selectedFromNumber || 'Default Platform Line'}
                  </span>
                </div>
              </div>

              {/* Live Transcript Stream */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                    Live Speech Transcript Feed
                  </span>
                  <span className="text-[10px] font-mono font-normal">Session: {activeCallId?.slice(0, 10)}...</span>
                </div>

                <div className="h-56 overflow-y-auto p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                  {transcripts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-2">
                      <Mic className="w-6 h-6 text-slate-300 dark:text-slate-700 animate-bounce" />
                      <p className="text-xs font-medium">Listening to live conversation...</p>
                      <p className="text-[11px] text-slate-400 max-w-xs">
                        Speak into your phone. As you talk with the AI agent, your words will appear here in real time.
                      </p>
                    </div>
                  ) : (
                    transcripts.map((t, idx) => (
                      <div 
                        key={idx} 
                        className={`flex flex-col ${t.speaker === 'agent' ? 'items-start' : 'items-end'}`}
                      >
                        <span className="text-[10px] font-bold text-slate-400 mb-0.5 flex items-center gap-1">
                          {t.speaker === 'agent' ? '🤖 Agent' : '👤 You'} • {t.timestamp}
                        </span>
                        <div 
                          className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed shadow-xs ${
                            t.speaker === 'agent'
                              ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-tl-xs'
                              : 'bg-emerald-600 text-white rounded-tr-xs'
                          }`}
                        >
                          {t.text}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={transcriptEndRef} />
                </div>
              </div>

              {/* Call Controls */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
                {callStatus !== 'completed' && callStatus !== 'failed' ? (
                  <button
                    onClick={handleTerminateCall}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <PhoneOff className="w-4 h-4" />
                    <span>End Active Call</span>
                  </button>
                ) : (
                  <button
                    onClick={handleReset}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Place Another Call</span>
                  </button>
                )}

                {onNavigateToLiveMonitoring && (
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateToLiveMonitoring(activeCallId || undefined);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>View in Full Live Monitor</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : activeTab === 'outbound' ? (
            /* OUTBOUND TEST FORM */
            <form onSubmit={handleInitiateOutboundCall} className="space-y-4">
              {/* Destination Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Destination Phone Number (To)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Must include country code (e.g. +91...)</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={toPhoneNumber}
                    onChange={(e) => setToPhoneNumber(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Enter your real mobile number. The platform telephony gateway will place an actual call to this phone.
                </p>
              </div>

              {/* Caller ID (From Number) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Active Caller ID (From)
                </label>
                <select
                  value={selectedFromNumber}
                  onChange={(e) => setSelectedFromNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                >
                  {availableNumbers.map((num) => (
                    <option key={num.id} value={num.phoneNumber}>
                      {num.phoneNumber} ({num.region || 'India Local'} • {num.telephonyProvider ? num.telephonyProvider.toUpperCase() : 'VOBIZ'})
                    </option>
                  ))}
                  {availableNumbers.length === 0 && (
                    <option value="">+918065530386 (Claritiy System Line)</option>
                  )}
                </select>
              </div>

              {/* Agent Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Agent to Conduct Call
                </label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  {availableAgents.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.name} ({ag.voiceName || 'Puck'} Voice • {ag.languageMode || 'English'})
                    </option>
                  ))}
                  {availableAgents.length === 0 && (
                    <option value="d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d22">Claritiy Voice Assistant (Default)</option>
                  )}
                </select>
              </div>

              {/* Recording Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <Disc className={`w-4 h-4 ${recordCall ? 'text-rose-600' : 'text-slate-400'}`} />
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Record Call Audio</span>
                    <span className="text-[10px] text-slate-500">Record conversation audio and save full transcript for live review.</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={recordCall}
                  onChange={(e) => setRecordCall(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 cursor-pointer"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={connecting}
                  className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs font-extrabold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>{connecting ? 'Dialing Real Phone...' : 'Initiate Outbound Call Now'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* INBOUND TEST INSTRUCTIONS & REAL-TIME RADAR */
            <div className="space-y-5 animate-fadeIn">
              <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-slate-50 to-slate-100 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 border border-emerald-500/20 text-center space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-3 py-1 rounded-full">
                  Step 1: Dial This Number From Your Phone
                </span>

                <div className="flex items-center justify-center gap-3">
                  <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
                    {selectedFromNumber || '+918065530386'}
                  </h2>
                  <button
                    onClick={() => handleCopy(selectedFromNumber || '+918065530386')}
                    title="Copy phone number"
                    className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                  Pick up your smartphone or office telephone and dial the above number right now. 
                  Your assigned AI Agent will answer immediately on the second ring.
                </p>

                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <Bot className="w-4 h-4 text-emerald-600" />
                  <span>Assigned Inbound Agent: <strong>{currentAgent?.name || 'Claritiy Voice Assistant'}</strong></span>
                </div>
              </div>

              {/* Inbound Radar Box */}
              <div className="p-5 rounded-2xl bg-slate-900 text-white border border-slate-800 text-center space-y-3 shadow-md">
                <div className="relative w-12 h-12 mx-auto flex items-center justify-center">
                  <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                  <span className="absolute inset-2 rounded-full bg-emerald-500/40 animate-pulse" />
                  <Radio className="w-6 h-6 text-emerald-400 relative z-10" />
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white flex items-center justify-center gap-1.5">
                    <span>Live Inbound Radar Active</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Listening for incoming call rings on {selectedFromNumber || '+91 80 6553 0386'}...
                  </p>
                </div>

                <div className="text-[11px] text-slate-500 font-mono">
                  As soon as your carrier connects, this screen switches automatically into live conversation monitoring.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
