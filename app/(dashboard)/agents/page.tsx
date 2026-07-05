'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import api from '@/lib/api-client';

interface Transcript {
  id: string;
  speaker: string;
  text: string;
  timestamp: number;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  agentType: string;
  agentConfig: string;
  flowGraph?: string;
  temperature?: number;
  systemPrompt?: string;
  voiceName?: string;
  status: string;
}

export default function AgentsPage() {
  const { data: session } = useSession();

  const getRuntimeUrls = () => {
    const envUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
    const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    const apiBase = envUrl || (isLocal ? 'http://localhost:3001' : 'https://ai-voice-agent-backend-mv32.onrender.com');
    const wsBase = process.env.NEXT_PUBLIC_WS_URL || apiBase.replace(/^http/, 'ws');
    return { apiBase, wsBase };
  };

  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('+919876543210');
  const [callStatus, setCallStatus] = useState<string>('idle');
  const [duration, setDuration] = useState<number>(0);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [callId, setCallId] = useState<string | null>(null);
  const [dialing, setDialing] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchAgents();
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (['connected', 'in_progress'].includes(callStatus)) {
      timer = setInterval(() => setDuration((prev) => prev + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [callStatus]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchAgents = async () => {
    try {
      const { apiBase } = getRuntimeUrls();
      const res = await api.get(`${apiBase}/api/v2/agents`);
      if (res.data && res.data.success && res.data.data.length > 0) {
        setAgents(res.data.data);
        setSelectedAgentId(res.data.data[0].id);
      }
    } catch (err: any) {
      console.error('Fetch agents failure:', err);
    }
  };

  const handleInitiateCall = async () => {
    const activeAgentId = selectedAgentId || 'default-agent';
    try {
      setDialing(true);
      setCallStatus('initiating');
      setTranscripts([]);
      setDuration(0);
      setCallId(null);

      const { apiBase } = getRuntimeUrls();
      const res = await api.post(`${apiBase}/api/calls/outbound`, {
        phoneNumber,
        agentId: activeAgentId,
        userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
      });

      if (res.data && res.data.success && res.data.data) {
        setCallId(res.data.data.callId);
        setCallStatus(res.data.data.status);
        startCallMonitoring(res.data.data.callId);
      }
    } catch (err: any) {
      console.error('Call placement failed:', err);
      setCallStatus('failed');
      showToast('error', `Call placement failed: ${err.message || 'Backend unreachable'}`);
    } finally {
      setDialing(false);
    }
  };

  const handleHangUp = async () => {
    if (!callId) return;
    try {
      const { apiBase } = getRuntimeUrls();
      await api.post(`${apiBase}/api/v2/calls/${callId}/terminate`);
      setCallStatus('completed');
      stopCallMonitoring();
    } catch (err: any) {
      console.error('Failed to terminate call:', err);
      showToast('error', `Failed to terminate call: ${err.message || 'Backend unreachable'}`);
    }
  };

  const startCallMonitoring = (cId: string) => {
    stopCallMonitoring();
    const { apiBase, wsBase } = getRuntimeUrls();
    const ws = new WebSocket(`${wsBase}/live-transcript?callId=${cId}`);
    wsRef.current = ws;
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'transcript') {
          setTranscripts((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.speaker === data.speaker && !data.isFinal) {
              return [...prev.slice(0, -1), { id: last.id, speaker: data.speaker, text: data.text, timestamp: Date.now() }];
            } else {
              return [...prev, { id: `t-${Date.now()}`, speaker: data.speaker, text: data.text, timestamp: Date.now() }];
            }
          });
        }
      } catch (e) {
        console.error(e);
      }
    };

    ws.onerror = (error) => {
      console.error('Live monitor WebSocket error:', error);
    };

    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`${apiBase}/api/v2/calls/${cId}`);
        if (res.data && res.data.success && res.data.data) {
          setCallStatus(res.data.data.status);
          if (['completed', 'failed', 'no_answer', 'busy', 'cancelled'].includes(res.data.data.status)) {
            stopCallMonitoring();
          }
        }
      } catch (e) {
        console.error('Call status polling error:', e);
      }
    }, 1500);
  };

  const stopCallMonitoring = () => {
    if (wsRef.current) wsRef.current.close();
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const formatSecToTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'initiating': return 'Connecting Line...';
      case 'ringing': return 'Phone Ringing...';
      case 'connected':
      case 'in_progress': return 'Active Channel';
      case 'completed': return 'Call Finished';
      case 'failed': return 'Failed Connect';
      default: return 'Online Playground';
    }
  };

  return (
    <div className="bg-[#090D16] text-[#F8FAFC] min-h-screen flex items-center justify-center p-6 relative overflow-hidden w-full">
      <style>{`
        aside { display: none !important; }
        header { display: none !important; }
        .pl-64, [class*="pl-64"] { padding-left: 0 !important; }
        main { padding: 0 !important; background: #090D16 !important; }
        div.max-w-7xl { max-width: 100% !important; margin: 0 !important; }
        div.flex.items-center.gap-2.text-xs { display: none !important; }
      `}</style>

      {/* Notifications toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 p-4 rounded-xl text-sm font-semibold shadow-2xl border ${
          toast.type === 'success' ? 'bg-[#065F46] border-[#34D399] text-[#F8FAFC]' : 'bg-[#991B1B] border-[#F87171] text-[#F8FAFC]'
        }`}>
          {toast.text}
        </div>
      )}

      {/* Main Glassmorphism Panel */}
      <div className="bg-[#141C2F] border border-[#1E293B] rounded-xl p-8 max-w-lg w-full shadow-2xl text-center relative z-10">
        <div className="h-1 w-20 bg-[#10B981] rounded-full mx-auto mb-6 shadow-[0_0_10px_#10B981]" />

        <h1 className="text-2xl font-extrabold mb-2 tracking-tight bg-gradient-to-r from-[#F8FAFC] to-[#94A3B8] bg-clip-text text-transparent">
          Clarity Voice AI
        </h1>
        <p className="text-sm text-[#94A3B8] font-medium mb-8">
          Automated HR Screening Arena
        </p>

        {/* Telephony input & action controls */}
        <div className="flex flex-col gap-5 text-left">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-2">
              Candidate Phone Number (E.164)
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+91XXXXXXXXXX"
              className="w-full bg-[#0F172A] border border-[#334155] rounded-lg p-3.5 text-sm font-mono text-[#F8FAFC] outline-none focus:border-[#10B981] transition-all box-border"
            />
          </div>

          <div className="mt-2">
            {['initiating', 'ringing', 'connected', 'in_progress'].includes(callStatus) ? (
              <button
                onClick={handleHangUp}
                disabled={dialing}
                className="w-full p-4 bg-[#DC2626] hover:bg-[#B91C1C] text-[#F8FAFC] border-none rounded-xl text-sm font-bold cursor-pointer shadow-lg hover:shadow-xl transition-all"
              >
                Hang Up Connection
              </button>
            ) : (
              <button
                onClick={handleInitiateCall}
                disabled={dialing}
                className="w-full p-4 bg-[#10B981] hover:bg-[#059669] text-[#F8FAFC] border-none rounded-xl text-sm font-bold cursor-pointer shadow-lg hover:shadow-xl transition-all"
              >
                Initiate Live Screen Call
              </button>
            )}
          </div>

          {/* Interactive call status tracker */}
          <div className="flex justify-between items-center bg-[#0F172A] border border-[#1E293B] rounded-lg p-3 text-xs">
            <span className="text-[#94A3B8] font-medium">Line Status</span>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full inline-block ${
                ['connected', 'in_progress'].includes(callStatus) ? 'bg-[#10B981]' : (callStatus === 'idle' ? 'bg-[#64748B]' : 'bg-[#F59E0B]')
              }`} />
              <strong className="text-[#F8FAFC]">{getStatusLabel(callStatus)}</strong>
              {['connected', 'in_progress'].includes(callStatus) && (
                <span className="text-[#10B981] font-mono ml-1.5">({formatSecToTime(duration)})</span>
              )}
            </div>
          </div>

          {/* Dialogue transcription logs */}
          <div className="mt-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-2">
              Live Dialogue Transcription
            </label>
            <div className="h-44 bg-[#0F172A] border border-[#1E293B] rounded-xl p-4 overflow-y-auto flex flex-col gap-3 scroll-smooth">
              {transcripts.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[#475569] text-xs font-medium">
                  Awaiting screening stream connection...
                </div>
              ) : (
                transcripts.map((t) => {
                  const isAgent = t.speaker === 'agent';
                  return (
                    <div
                      key={t.id}
                      className={`flex w-full ${isAgent ? 'justify-start' : 'justify-end'}`}
                    >
                      <div className={`p-2.5 rounded-xl text-xs leading-relaxed max-w-[85%] text-left ${
                        isAgent ? 'bg-[#1E293B] border border-[#334155] rounded-bl-sm text-[#F8FAFC]' : 'bg-[#064E3B] border border-[#065F46] rounded-br-sm text-[#F8FAFC]'
                      }`}>
                        <span className={`block text-[10px] font-bold uppercase mb-1 ${isAgent ? 'text-[#38BDF8]' : 'text-[#34D399]'}`}>
                          {isAgent ? 'Clarity Recruiter' : 'Candidate'}
                        </span>
                        {t.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={scrollRef} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
