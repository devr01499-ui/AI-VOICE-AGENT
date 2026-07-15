'use client';

import React, { useState, useEffect, useRef } from 'react';

interface Transcript {
  id: string;
  speaker: string;
  text: string;
  timestamp: number;
}

export default function HomePage() {
  const getRuntimeUrl = () => {
    const envUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
    const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    return envUrl || (isLocal ? 'http://localhost:3001' : 'https://ai-voice-agent-backend-mv32.onrender.com');
  };

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

  const handleStartCall = async () => {
    if (!phoneNumber) return;
    setCallStatus('ringing');
    setTranscripts([]);
    setCallDuration(0);
    setDialing(true);

    try {
      const absoluteApiTarget = 'https://ai-voice-agent-backend-mv32.onrender.com/api/v2/calls';

      const res = await fetch(absoluteApiTarget, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          'x-request-id':
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : Math.random().toString(36).substring(2),
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          agentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        }),
      });

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const rawText = await res.text();
        console.error('Server returned non-JSON payload', rawText);
        throw new Error(`Server returned invalid content-type (${contentType}).`);
      }

      const json = await res.json();
      if (json.success && json.data) {
        const actualCallId = json.data.callId || json.data.id;
        if (!actualCallId) {
          throw new Error('Unable to resolve call identifier from backend response');
        }
        setActiveCallId(actualCallId);
        setCallStatus('ringing');
        startWebSocketMonitoring(actualCallId);
      } else {
        setCallStatus('failed');
      }
    } catch (err: unknown) {
      console.error('Outbound Signaling Failure:', err);
      setCallStatus('failed');
      const errorMsg =
        err instanceof Error ? err.message : 'Backend unreachable';
      alert(`Outbound Connection Failed: ${errorMsg}`);
    } finally {
      setDialing(false);
    }
  };

  const handleHangUp = async () => {
    const callId = activeCallId;
    if (!callId) return;
    try {
      const apiBase = getRuntimeUrl();
      await fetch(`${apiBase}/api/v2/calls/${callId}/terminate`, {
        method: 'POST',
        headers: {
          'x-user-id': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        },
      });
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
      const apiBase = getRuntimeUrl();
      const res = await fetch(`${apiBase}/api/v2/calls/sip-trunks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        },
        body: JSON.stringify({
          name: sipName,
          sipUri,
          username: sipUsername,
          password: sipPassword,
          outboundProxy: sipOutboundProxy,
        }),
      });
      const data = await res.json();
      if (data && data.success) {
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
    } catch (err: unknown) {
      console.error(err);
      showToast('error', `Failed to register: ${err instanceof Error ? err.message : 'Error occurred'}`);
    } finally {
      setRegisteringSip(false);
    }
  };

  const startWebSocketMonitoring = (callId: string) => {
    stopWebSocketMonitoring();
    const apiBase = getRuntimeUrl();

    let wsTarget = apiBase;
    if (wsTarget.startsWith('/')) {
      if (typeof window !== 'undefined') {
        wsTarget = window.location.origin.replace(/^http/, 'ws') + wsTarget;
      }
    } else {
      wsTarget = wsTarget.replace(/^http/, 'ws');
    }

    const wsUrl = `${wsTarget}/live-transcript?callId=${callId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'transcript') {
          setTranscripts((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.speaker === data.speaker && !data.isFinal) {
              return [
                ...prev.slice(0, -1),
                { id: last.id, speaker: data.speaker, text: data.text, timestamp: Date.now() },
              ];
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
        const apiBase = getRuntimeUrl();
        const res = await fetch(`${apiBase}/api/v2/calls/${callId}`, {
          headers: { 'x-user-id': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' },
        });
        const data = await res.json();
        if (data && data.success && data.data) {
          const status = data.data.status;
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
      {/* Notifications toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 p-4 rounded-xl text-sm font-semibold shadow-2xl border ${
            toast.type === 'success'
              ? 'bg-[#065F46] border-[#34D399] text-[#F8FAFC]'
              : 'bg-[#991B1B] border-[#F87171] text-[#F8FAFC]'
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Grid Layout Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl w-full z-10">

        {/* Left Column: Recruiter Profile Card */}
        <div className="bg-[#141C2F] border border-[#1E293B] rounded-xl p-8 shadow-2xl flex flex-col justify-between text-left">
          <div>
            <div className="h-1 w-20 bg-[#6366F1] rounded-full mb-6 shadow-[0_0_10px_#6366F1]" />
            <h2 className="text-xl font-bold mb-2 tracking-tight text-white">Active Voice Recruiter</h2>
            <p className="text-xs text-[#94A3B8] font-medium mb-6">Customer Support screening agent details</p>

            <div className="flex flex-col gap-4 text-xs">
              <div className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-4">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-1">Agent Name</span>
                <span className="text-[#F8FAFC] font-semibold text-sm">Clarity HR Customer Support Screener</span>
              </div>

              <div className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-4">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-2">Screening Questions</span>
                <ul className="list-decimal pl-4 space-y-2 text-[#94A3B8]">
                  <li>Describe a situation where you resolved conflict with a frustrated customer.</li>
                  <li>How do you handle high call volumes while remaining warm and positive?</li>
                  <li>What are your expected salary bounds for this position?</li>
                </ul>
              </div>

              <div className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-4 flex justify-between items-center">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-0.5">Model Engine</span>
                  <span className="text-[#F8FAFC] font-mono">Gemini 2.5 Flash</span>
                </div>
                <span className="px-2.5 py-1 rounded bg-[#6366F1]/10 text-[#818CF8] text-[10px] font-bold border border-[#4F46E5]/30">
                  Realtime API
                </span>
              </div>

              <div className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-4 flex justify-between items-center">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-0.5">Voice Tone</span>
                  <span className="text-[#F8FAFC] font-semibold">Puck (Human-like, Clear, Smooth)</span>
                </div>
                <span className="px-2.5 py-1 rounded bg-[#10B981]/10 text-[#34D399] text-[10px] font-bold border border-[#059669]/30">
                  Active
                </span>
              </div>
            </div>
          </div>
          <div className="text-[10px] text-[#64748B] mt-6 text-center border-t border-[#1E293B] pt-4 font-mono">
            Agent ID: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
          </div>
        </div>

        {/* Right Column: Clarity Voice AI Panel */}
        <div className="bg-[#141C2F] border border-[#1E293B] rounded-xl p-8 shadow-2xl text-center relative flex flex-col justify-between">
          <div>
            <div className="h-1 w-20 bg-[#10B981] rounded-full mx-auto mb-6 shadow-[0_0_10px_#10B981]" />

            <h1 className="text-2xl font-extrabold mb-2 tracking-tight bg-gradient-to-r from-[#F8FAFC] to-[#94A3B8] bg-clip-text text-transparent">
              Clarity Voice AI
            </h1>
            <p className="text-sm text-[#94A3B8] font-medium mb-8">Automated HR Screening Arena</p>

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
                    onClick={handleStartCall}
                    disabled={dialing}
                    className="w-full p-4 bg-[#10B981] hover:bg-[#059669] text-[#F8FAFC] border-none rounded-xl text-sm font-bold cursor-pointer shadow-lg hover:shadow-xl transition-all"
                  >
                    Initiate Live Screen Call
                  </button>
                )}
              </div>

              <div className="flex justify-between items-center bg-[#0F172A] border border-[#1E293B] rounded-lg p-3 text-xs">
                <span className="text-[#94A3B8] font-medium">Line Status</span>
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full inline-block ${
                      callStatus === 'connected'
                        ? 'bg-[#10B981]'
                        : callStatus === 'idle'
                        ? 'bg-[#64748B]'
                        : 'bg-[#F59E0B]'
                    }`}
                  />
                  <strong className="text-[#F8FAFC]">{getStatusLabel(callStatus)}</strong>
                  {callStatus === 'connected' && (
                    <span className="text-[#10B981] font-mono ml-1.5">({formatSecToTime(callDuration)})</span>
                  )}
                </div>
              </div>

              <div className="mt-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-2">
                  Live Dialogue Transcription
                </label>
                <div className="w-full h-44 bg-[#0F172A] border border-[#1E293B] rounded-lg p-4 overflow-y-auto flex flex-col gap-3 font-sans text-xs box-border">
                  {transcripts.length === 0 ? (
                    <div className="text-[#64748B] text-center italic my-auto">
                      Dialogue streams will render here in real-time...
                    </div>
                  ) : (
                    transcripts.map((t) => (
                      <div key={t.id} className="flex flex-col gap-1">
                        <span
                          className={`font-bold tracking-wide uppercase text-[9px] ${
                            t.speaker === 'agent' ? 'text-[#818CF8]' : 'text-[#34D399]'
                          }`}
                        >
                          {t.speaker === 'agent' ? 'Clarity Recruiter' : 'Candidate'}
                        </span>
                        <p className="text-[#E2E8F0] m-0 leading-relaxed font-medium">{t.text}</p>
                      </div>
                    ))
                  )}
                  <div ref={scrollRef} />
                </div>
              </div>
            </div>
          </div>

          {/* SIP Trunking panel */}
          <div className="mt-8 pt-6 border-t border-[#1E293B] text-left">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-semibold text-[#94A3B8]">External SIP Carrier Trunk</span>
              <button
                onClick={() => setShowSipForm(!showSipForm)}
                className="text-[10px] font-bold px-2 py-1 rounded bg-[#334155] hover:bg-[#475569] text-[#F8FAFC] border-none cursor-pointer transition-all"
              >
                {showSipForm ? 'Collapse Configuration' : 'Configure Custom Trunk'}
              </button>
            </div>

            {showSipForm && (
              <form
                onSubmit={handleConnectSipTrunk}
                className="flex flex-col gap-4 bg-[#0F172A] border border-[#1E293B] rounded-lg p-4 box-border"
              >
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                      Carrier Name
                    </label>
                    <input
                      type="text"
                      value={sipName}
                      onChange={(e) => setSipName(e.target.value)}
                      placeholder="e.g. Twilio / Vobiz"
                      required
                      className="w-full bg-[#0F172A] border border-[#334155] rounded-md p-2 text-xs text-[#F8FAFC] outline-none focus:border-[#10B981] transition-all box-border"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                      SIP URI (Domain / IP)
                    </label>
                    <input
                      type="text"
                      value={sipUri}
                      onChange={(e) => setSipUri(e.target.value)}
                      placeholder="sip.carrier.com"
                      required
                      className="w-full bg-[#0F172A] border border-[#334155] rounded-md p-2 text-xs text-[#F8FAFC] outline-none focus:border-[#10B981] transition-all box-border"
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                      Username / Auth ID
                    </label>
                    <input
                      type="text"
                      value={sipUsername}
                      onChange={(e) => setSipUsername(e.target.value)}
                      placeholder="Username"
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
