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

export default function AgentsPage() {
  const { data: session } = useSession();

  const getRuntimeUrl = () => {
    const envUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
    const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    return envUrl || (isLocal ? 'http://localhost:3001' : 'https://ai-voice-agent-backend-mv32.onrender.com');
  };

  // 1. STATE SCHEMAS
  const [phoneNumber, setPhoneNumber] = useState<string>('+919876543210');
  const [callStatus, setCallStatus] = useState<'idle' | 'ringing' | 'connected' | 'completed' | 'failed'>('idle');
  const [callDuration, setCallDuration] = useState<number>(0);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  
  const [dialing, setDialing] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // SIP Trunk connection states
  const [showSipForm, setShowSipForm] = useState<boolean>(false);
  const [sipName, setSipName] = useState<string>('');
  const [sipUri, setSipUri] = useState<string>('');
  const [sipUsername, setSipUsername] = useState<string>('');
  const [sipPassword, setSipPassword] = useState<string>('');
  const [sipOutboundProxy, setSipOutboundProxy] = useState<string>('');
  const [registeringSip, setRegisteringSip] = useState<boolean>(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (callStatus === 'connected') {
      timer = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
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

  // 2. THE OUTBOUND TRANSACTION LOOP
  const handleInitiateCall = async () => {
    if (!phoneNumber) return;
    setCallStatus('ringing');
    setTranscripts([]);
    setCallDuration(0);
    setDialing(true);

    const selectedAgentId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    const setCallId = setActiveCallId;
    const startCallMonitoring = startWebSocketMonitoring;
    
    try {
      const apiBase = getRuntimeUrl();
      const res = await fetch(`${apiBase}/api/v2/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phoneNumber,
          agentId: selectedAgentId,
          userId: 'dev-user-001'
        })
      });

      const json = await res.json();
      if (json.success && json.data) {
        const actualCallId = json.data.callId || json.data.id;
        setCallId(actualCallId);
        setCallStatus(json.data.status || 'ringing');
        startCallMonitoring(actualCallId);
      } else {
        setCallStatus('failed');
      }
    } catch (err: any) {
      console.error("Outbound Signaling Failure:", err);
      setCallStatus('failed');
      const errorMsg = err.response?.data?.message || err.message || "Backend unreachable";
      alert(`Outbound Connection Failed: ${errorMsg}`);
    } finally {
      setDialing(false);
    }
  };

  // 3. THE DISCONNECT CHAIN
  const handleHangUp = async () => {
    const callId = activeCallId;
    if (!callId) return;
    try {
      const apiBase = getRuntimeUrl();
      await fetch(`${apiBase}/api/v2/calls/${callId}/terminate`, { method: 'POST' });
    } finally {
      setCallStatus('completed');
      setActiveCallId(null);
      stopWebSocketMonitoring();
    }
  };

  const handleConnectSipTrunk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sipUri) {
      showToast('error', 'SIP URI is required');
      return;
    }
    setRegisteringSip(true);
    try {
      const res = await api.post('/api/v2/calls/sip-trunks', {
        name: sipName,
        sipUri,
        username: sipUsername,
        password: sipPassword,
        outboundProxy: sipOutboundProxy
      });
      if (res.data && res.data.success) {
        showToast('success', 'SIP Trunk registered successfully!');
        setShowSipForm(false);
        setSipName('');
        setSipUri('');
        setSipUsername('');
        setSipPassword('');
        setSipOutboundProxy('');
      } else {
        showToast('error', 'Registration failed');
      }
    } catch (err: any) {
      console.error(err);
      showToast('error', `Failed to register: ${err.message || 'Error occurred'}`);
    } finally {
      setRegisteringSip(false);
    }
  };

  const startWebSocketMonitoring = (callId: string) => {
    stopWebSocketMonitoring();
    const apiBase = getRuntimeUrl();
    const wsTarget = apiBase.replace(/^http/, 'ws') + `/api/v2/calls/stream/${callId}`;
    const ws = new WebSocket(wsTarget);
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

    ws.onclose = () => {
      setCallStatus('completed');
      setActiveCallId(null);
      stopWebSocketMonitoring();
    };

    ws.onerror = (error) => {
      console.error('Live monitor WebSocket error:', error);
      setCallStatus('completed');
      setActiveCallId(null);
      stopWebSocketMonitoring();
    };

    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/api/v2/calls/${callId}`);
        if (res.data && res.data.success && res.data.data) {
          const status = res.data.data.status;
          if (status === 'connected' || status === 'in_progress') {
            setCallStatus('connected');
          } else if (['completed', 'failed', 'no_answer', 'busy', 'cancelled'].includes(status)) {
            setCallStatus(status === 'completed' ? 'completed' : 'failed');
            stopWebSocketMonitoring();
          }
        }
      } catch (e) {
        console.error('Call status polling error:', e);
      }
    }, 1500);
  };

  const stopWebSocketMonitoring = () => {
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
      case 'connected': return 'Active Channel';
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
            {['ringing', 'connected'].includes(callStatus) ? (
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
                callStatus === 'connected' ? 'bg-[#10B981]' : (callStatus === 'idle' ? 'bg-[#64748B]' : 'bg-[#F59E0B]')
              }`} />
              <strong className="text-[#F8FAFC]">{getStatusLabel(callStatus)}</strong>
              {callStatus === 'connected' && (
                <span className="text-[#10B981] font-mono ml-1.5">({formatSecToTime(callDuration)})</span>
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
                        isAgent ? 'bg-[#4F46E5]/20 text-[#818CF8] border border-[#4F46E5]/40' : 'bg-[#1E293B] text-slate-100 border border-slate-700'
                      }`}>
                        <span className={`block text-[10px] font-bold uppercase mb-1 ${isAgent ? 'text-[#818CF8]' : 'text-slate-400'}`}>
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

          {/* SIP Trunk connection manager */}
          <div className="mt-4 pt-4 border-t border-[#1E293B]">
            <button
              onClick={() => setShowSipForm(!showSipForm)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-all"
            >
              {showSipForm ? 'Hide SIP Trunk Config' : 'Configure SIP Trunk Connection'}
            </button>

            {showSipForm && (
              <form onSubmit={handleConnectSipTrunk} className="mt-4 flex flex-col gap-3.5 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                    Trunk Name (Friendly)
                  </label>
                  <input
                    type="text"
                    value={sipName}
                    onChange={(e) => setSipName(e.target.value)}
                    placeholder="Clarity Primary Trunk"
                    className="w-full bg-[#0F172A] border border-[#334155] rounded-md p-2 text-xs text-[#F8FAFC] outline-none focus:border-[#10B981] transition-all box-border"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                    SIP URI *
                  </label>
                  <input
                    type="text"
                    value={sipUri}
                    onChange={(e) => setSipUri(e.target.value)}
                    placeholder="sip:trunk.example.com"
                    required
                    className="w-full bg-[#0F172A] border border-[#334155] rounded-md p-2 text-xs text-[#F8FAFC] outline-none focus:border-[#10B981] transition-all box-border"
                  />
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                      Username
                    </label>
                    <input
                      type="text"
                      value={sipUsername}
                      onChange={(e) => setSipUsername(e.target.value)}
                      placeholder="User"
                      className="w-full bg-[#0F172A] border border-[#334155] rounded-md p-2 text-xs text-[#F8FAFC] outline-none focus:border-[#10B981] transition-all box-border"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                      Password
                    </label>
                    <input
                      type="password"
                      value={sipPassword}
                      onChange={(e) => setSipPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full bg-[#0F172A] border border-[#334155] rounded-md p-2 text-xs text-[#F8FAFC] outline-none focus:border-[#10B981] transition-all box-border"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                    Outbound Proxy
                  </label>
                  <input
                    type="text"
                    value={sipOutboundProxy}
                    onChange={(e) => setSipOutboundProxy(e.target.value)}
                    placeholder="proxy.example.com"
                    className="w-full bg-[#0F172A] border border-[#334155] rounded-md p-2 text-xs text-[#F8FAFC] outline-none focus:border-[#10B981] transition-all box-border"
                  />
                </div>

                <button
                  type="submit"
                  disabled={registeringSip}
                  className="w-full py-2 bg-[#10B981] hover:bg-[#059669] text-white border-none rounded-md text-xs font-bold cursor-pointer transition-all shadow-md mt-1"
                >
                  {registeringSip ? 'Connecting...' : 'Register SIP Trunk'}
                </button>
              </form>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
