'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  X,
  Phone,
  PhoneOff,
  Play,
  Volume2,
  Loader2,
  Bot,
  User,
  AlertCircle,
  Clock,
  Sparkles,
  Zap,
  CheckCircle,
  Activity,
} from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  description: string | null;
  agentType: string;
  status: string;
}

interface TranscriptSegment {
  id: string;
  speaker: 'agent' | 'user';
  content: string;
  startTime: number;
  endTime: number | null;
  sequenceNumber: number;
}

interface TestCallDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCallSimulated?: () => void;
  fromPhoneNumber?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function TestCallDialog({ isOpen, onClose, onCallSimulated, fromPhoneNumber }: TestCallDialogProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('+919876543210');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Call session states
  const [callId, setCallId] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<string>('idle'); // idle, initiating, ringing, connected, in_progress, completed, failed, cancelled, busy, no_answer
  const [transcripts, setTranscripts] = useState<TranscriptSegment[]>([]);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [metrics, setMetrics] = useState<{
    asrLatencyMs?: number;
    llmLatencyMs?: number;
    ttsLatencyMs?: number;
  }>({});

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch agents on mount
  useEffect(() => {
    if (isOpen) {
      fetchAgents();
    }
    return () => {
      stopPolling();
    };
  }, [isOpen]);

  // Scroll to bottom of transcripts when updated
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  // Handle call duration counter
  useEffect(() => {
    if (callStatus === 'connected' || callStatus === 'in_progress') {
      if (!durationIntervalRef.current) {
        durationIntervalRef.current = setInterval(() => {
          setDurationSeconds((prev) => prev + 1);
        }, 1000);
      }
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [callStatus]);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/api/v2/agents`);
      if (!res.ok) throw new Error('Failed to load agents');
      const json = await res.json();
      if (json.success && json.data) {
        setAgents(json.data);
        if (json.data.length > 0) {
          setSelectedAgentId(json.data[0].id);
        }
      }
    } catch (err) {
      loggerError('Error loading agents', err);
      setError('Could not retrieve agent configurations. Please check if backend is running on port 3001.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId) {
      setError('Please select an agent to call.');
      return;
    }
    if (!phoneNumber.match(/^\+?[1-9]\d{6,14}$/)) {
      setError('Please enter a valid phone number in E.164 format (e.g., +919876543210).');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setRecordingUrl(null);
      setTranscripts([]);
      setDurationSeconds(0);
      setCallStatus('initiating');

      const res = await fetch(`${API_BASE_URL}/api/v2/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          agentId: selectedAgentId,
          userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', // seeded dev user
          userData: { source: 'dashboard-test-call' },
          fromPhoneNumber,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || 'Failed to place call');
      }

      const json = await res.json();
      if (json.success && json.data) {
        const newCallId = json.data.callId;
        setCallId(newCallId);
        setCallStatus(json.data.status); // ringing
        startPolling(newCallId);
        if (onCallSimulated) {
          onCallSimulated();
        }
      }
    } catch (err) {
      loggerError('Error placing call', err);
      setError(err instanceof Error ? err.message : 'Failed to start call');
      setCallStatus('idle');
    } finally {
      setLoading(false);
    }
  };

  const handleHangUp = async () => {
    if (!callId) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/v2/calls/${callId}/terminate`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to hang up call');
      setCallStatus('cancelled');
      stopPolling();
      // Final poll to get final transcripts and recording URL
      await pollCallDetails(callId);
    } catch (err) {
      loggerError('Error hanging up call', err);
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (cId: string) => {
    stopPolling();
    pollIntervalRef.current = setInterval(() => {
      pollCallDetails(cId);
    }, 1500);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const pollCallDetails = async (cId: string) => {
    try {
      // 1. Poll Status & Recording Url
      const statusRes = await fetch(`${API_BASE_URL}/api/v2/calls/${cId}`);
      if (!statusRes.ok) return;
      const statusJson = await statusRes.json();
      if (statusJson.success && statusJson.data) {
        const details = statusJson.data;
        setCallStatus(details.status);
        
        if (details.execution?.recordingUrl) {
          setRecordingUrl(details.execution.recordingUrl);
        }

        if (details.runtime?.metrics) {
          setMetrics(details.runtime.metrics);
        }

        // Terminal status check
        const terminalStates = ['completed', 'failed', 'no_answer', 'busy', 'cancelled'];
        if (terminalStates.includes(details.status)) {
          stopPolling();
        }
      }

      // 2. Poll Transcripts
      const transcriptRes = await fetch(`${API_BASE_URL}/api/v2/calls/${cId}/transcript`);
      if (transcriptRes.ok) {
        const transJson = await transcriptRes.json();
        if (transJson.success && transJson.data) {
          setTranscripts(transJson.data);
        }
      }
    } catch (err) {
      loggerError('Polling error', err);
    }
  };

  const loggerError = (msg: string, err: unknown) => {
    console.error(`[TestCallDialog] ${msg}:`, err);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ringing':
        return 'text-amber-400 bg-amber-950/40 border-amber-900/30 animate-pulse';
      case 'connected':
      case 'in_progress':
        return 'text-emerald-400 bg-emerald-950/40 border-emerald-900/30';
      case 'completed':
        return 'text-slate-400 bg-slate-900 border-slate-800';
      case 'failed':
      case 'busy':
      case 'no_answer':
        return 'text-rose-400 bg-rose-950/40 border-rose-900/30';
      case 'cancelled':
        return 'text-slate-400 bg-slate-950 border-slate-800';
      default:
        return 'text-slate-500 bg-slate-950 border-slate-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'initiating': return 'Connecting Vobiz...';
      case 'ringing': return 'Ringing...';
      case 'connected': return 'Connected (WebSocket Active)';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Call Completed';
      case 'failed': return 'Failed';
      case 'busy': return 'Busy';
      case 'no_answer': return 'No Answer';
      case 'cancelled': return 'Terminated';
      default: return 'Ready';
    }
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  const isCallActive = ['initiating', 'ringing', 'connected', 'in_progress'].includes(callStatus);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop overlay */}
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" 
        onClick={isCallActive ? undefined : onClose}
      />

      {/* Modal box */}
      <div className="relative w-full max-w-xl rounded-xl border border-slate-800 bg-slate-950/90 shadow-2xl backdrop-blur-md overflow-hidden transform transition-all flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/20">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            <h3 className="text-lg font-bold text-white">Telephony Agent Test Environment</h3>
          </div>
          {!isCallActive && (
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-white rounded-lg p-1 hover:bg-slate-900 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {error && (
            <div className="p-4 rounded-lg bg-rose-950/30 border border-rose-900/50 flex items-start gap-3 text-rose-300 text-sm">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
              <div>{error}</div>
            </div>
          )}

          {callStatus === 'idle' ? (
            <form onSubmit={handleStartCall} className="space-y-5">
              
              {/* Agent Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Select Voice Agent</label>
                {loading && agents.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                    Fetching agents from SQLite database...
                  </div>
                ) : agents.length === 0 ? (
                  <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-850 text-center text-sm text-slate-400">
                    No active voice agents found. Run db seed to populate.
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedAgentId}
                      onChange={(e) => setSelectedAgentId(e.target.value)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-905 text-sm text-white px-4 py-3 outline-none focus:border-emerald-500 transition-colors appearance-none cursor-pointer"
                    >
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id} className="bg-slate-950 text-white">
                          {agent.name} ({agent.agentType}) [{agent.status}]
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 border-l border-r border-t border-slate-600 border-l-transparent border-r-transparent w-0 h-0 border-t-4" />
                  </div>
                )}
              </div>

              {/* Phone Number Input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Recipient Phone Number (E.164)</label>
                <div className="relative">
                  <Input
                    type="tel"
                    placeholder="+919876543210"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="pl-12 bg-slate-900 border-slate-800 text-white placeholder-slate-500 focus-visible:ring-emerald-500 focus-visible:ring-offset-0"
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                    <Phone className="h-4 w-4 text-emerald-500" />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">
                  Tip: Use default number `+919876543210` to trigger Mock mode if real credentials are not present.
                </p>
              </div>

              {/* Notice Area */}
              <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800/80 space-y-2 text-xs text-slate-400 leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold text-slate-300">
                  <Zap className="h-4 w-4 text-emerald-400" />
                  Vobiz Telephony Gateway
                </div>
                <div>
                  This test triggers an outbound SIP session through Vobiz. If mock mode is active, it simulates the callback lifecycle locally within 1.5 seconds.
                </div>
              </div>

              {/* Action */}
              <Button
                type="submit"
                disabled={loading || agents.length === 0}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-6 rounded-lg transition-all shadow-lg shadow-emerald-900/20"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Placing Call...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Phone className="h-4 w-4" /> Connect AI Voice Agent
                  </span>
                )}
              </Button>
            </form>
          ) : (
            
            /* CALL ACTIVE / COMPLETED SCREEN */
            <div className="space-y-6 flex flex-col h-full">
              
              {/* Call Status & Telemetry Bar */}
              <div className="p-4 rounded-lg border border-slate-800/80 bg-slate-900/30 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 border text-[10px] font-bold rounded uppercase tracking-wider ${getStatusColor(callStatus)}`}>
                    {getStatusLabel(callStatus)}
                  </span>
                  {(callStatus === 'connected' || callStatus === 'in_progress') && (
                    <span className="text-xs font-mono text-white flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" /> {formatDuration(durationSeconds)}
                    </span>
                  )}
                </div>

                {isCallActive ? (
                  <Button
                    onClick={handleHangUp}
                    variant="destructive"
                    className="text-xs bg-rose-600 hover:bg-rose-500 text-white"
                  >
                    <PhoneOff className="h-3.5 w-3.5 mr-2" /> Hang Up
                  </Button>
                ) : (
                  <Button
                    onClick={() => setCallStatus('idle')}
                    variant="outline"
                    className="text-xs bg-slate-900 border-slate-800 text-slate-300 hover:text-white"
                  >
                    New Test Call
                  </Button>
                )}
              </div>

              {/* Real-time speech bubbles */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-emerald-400" /> Live Agent Transcripts
                </label>
                <div className="h-64 rounded-lg border border-slate-800 bg-slate-950 p-4 overflow-y-auto space-y-4 stable-scrollbar">
                  {transcripts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-slate-500">
                      {isCallActive ? (
                        <>
                          <Loader2 className="h-6 w-6 animate-spin text-emerald-400 mb-2" />
                          <p className="text-sm font-medium">Waiting for speech...</p>
                          <p className="text-xs">Once the call starts, real-time transcription segments will pop up here.</p>
                        </>
                      ) : (
                        <p className="text-sm">No transcript captured during this call session.</p>
                      )}
                    </div>
                  ) : (
                    transcripts.map((t) => {
                      const isAgent = t.speaker === 'agent';
                      return (
                        <div
                          key={t.id}
                          className={`flex items-start gap-2.5 max-w-[85%] ${
                            isAgent ? 'mr-auto' : 'ml-auto flex-row-reverse'
                          }`}
                        >
                          <div className={`h-8 w-8 rounded-full border flex items-center justify-center shrink-0 ${
                            isAgent 
                              ? 'bg-blue-950/50 border-blue-900 text-blue-400' 
                              : 'bg-emerald-950/50 border-emerald-900 text-emerald-400'
                          }`}>
                            {isAgent ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                          </div>
                          <div className={`space-y-1 rounded-lg px-4 py-2.5 border text-sm ${
                            isAgent
                              ? 'bg-slate-900/60 border-slate-850 text-white'
                              : 'bg-emerald-950/20 border-emerald-900/30 text-emerald-300'
                          }`}>
                            <p className="leading-relaxed">{t.content}</p>
                            <span className="block text-[9px] text-slate-500 text-right">
                              {t.startTime.toFixed(1)}s
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={transcriptEndRef} />
                </div>
              </div>

              {/* Latency telemetry / Metrics */}
              {Object.keys(metrics).length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-900/20 p-2.5 rounded border border-slate-800/80 text-center">
                    <span className="block text-[9px] text-slate-500 font-bold uppercase">ASR Latency</span>
                    <span className="text-sm font-bold text-white">{metrics.asrLatencyMs ? `${metrics.asrLatencyMs}ms` : '—'}</span>
                  </div>
                  <div className="bg-slate-900/20 p-2.5 rounded border border-slate-800/80 text-center">
                    <span className="block text-[9px] text-slate-500 font-bold uppercase">LLM TTFT</span>
                    <span className="text-sm font-bold text-white">{metrics.llmLatencyMs ? `${metrics.llmLatencyMs}ms` : '—'}</span>
                  </div>
                  <div className="bg-slate-900/20 p-2.5 rounded border border-slate-800/80 text-center">
                    <span className="block text-[9px] text-slate-500 font-bold uppercase">TTS Latency</span>
                    <span className="text-sm font-bold text-white">{metrics.ttsLatencyMs ? `${metrics.ttsLatencyMs}ms` : '—'}</span>
                  </div>
                </div>
              )}

              {/* Recording Player section */}
              {recordingUrl && (
                <div className="p-4 bg-emerald-950/20 border border-emerald-900/30 rounded-lg space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-400 flex items-center gap-1">
                      <Volume2 className="h-4 w-4" /> Telephony Call Recording
                    </span>
                    <span className="text-slate-400">Captured in stereo WAV</span>
                  </div>
                  <audio 
                    controls 
                    src={recordingUrl} 
                    className="w-full bg-slate-900 rounded-lg outline-none [&::-webkit-media-controls-panel]:bg-slate-900 [&::-webkit-media-controls-current-time-display]:text-white [&::-webkit-media-controls-time-remaining-display]:text-white"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
