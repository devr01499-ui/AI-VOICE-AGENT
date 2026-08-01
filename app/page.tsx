'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SipSettingsModal } from './components/SipSettingsModal';
import { Settings2 } from 'lucide-react';

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

  const [isSipModalOpen, setIsSipModalOpen] = useState<boolean>(false);

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
          'x-user-id': '1e69187e-82d5-4166-929f-4bbba90e5304',
          'x-request-id':
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : Math.random().toString(36).substring(2),
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          agentId: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d22',
          userId: '1e69187e-82d5-4166-929f-4bbba90e5304',
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
          'x-user-id': '1e69187e-82d5-4166-929f-4bbba90e5304',
        },
      });
    } finally {
      setCallStatus('completed');
      setActiveCallId(null);
      stopWebSocketMonitoring();
    }
  };

  const handleConnectSipTrunk = async (config: {
    name: string;
    sipUri: string;
    username: string;
    password?: string;
    outboundProxy?: string;
  }) => {
    const apiBase = getRuntimeUrl();
    const res = await fetch(`${apiBase}/api/v2/calls/sip-trunks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': '1e69187e-82d5-4166-929f-4bbba90e5304',
      },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (!data || !data.success) {
      throw new Error('Registration failed');
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
          headers: { 'x-user-id': '1e69187e-82d5-4166-929f-4bbba90e5304' },
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
    <div className="bg-[#e0e5ec] text-[#4a5568] min-h-screen flex items-center justify-center p-6 relative overflow-hidden w-full font-sans">
      {/* Notifications toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 p-4 rounded-xl text-sm font-bold shadow-[6px_6px_12px_#b8bec7,-6px_-6px_12px_#ffffff] border ${
            toast.type === 'success'
              ? 'bg-[#e0e5ec] border-[#e0e5ec] text-emerald-600'
              : 'bg-[#e0e5ec] border-[#e0e5ec] text-red-600'
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Grid Layout Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-5xl w-full z-10">

        {/* Left Column: Recruiter Profile Card */}
        <div className="bg-[#e0e5ec] rounded-[32px] p-8 shadow-[12px_12px_24px_#b8bec7,-12px_-12px_24px_#ffffff] flex flex-col justify-between text-left border border-white/50 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/80 to-transparent"></div>
          <div>
            <div className="h-2 w-20 bg-indigo-500 rounded-full mb-6 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.5),0_0_10px_#6366F1]" />
            <h2 className="text-2xl font-extrabold mb-2 tracking-tight text-gray-700 drop-shadow-[1px_1px_1px_white]">Active Voice Recruiter</h2>
            <p className="text-xs text-gray-500 font-bold mb-6 drop-shadow-[1px_1px_1px_white]">Customer Support screening agent details</p>

            <div className="flex flex-col gap-5 text-xs">
              <div className="bg-[#e0e5ec] rounded-2xl p-5 shadow-[inset_6px_6px_12px_#b8bec7,inset_-6px_-6px_12px_#ffffff] border border-white/20">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 drop-shadow-[1px_1px_1px_white]">Agent Name</span>
                <span className="text-gray-700 font-extrabold text-sm drop-shadow-[1px_1px_1px_white]">Claritiy HR Customer Support Screener</span>
              </div>

              <div className="bg-[#e0e5ec] rounded-2xl p-5 shadow-[inset_6px_6px_12px_#b8bec7,inset_-6px_-6px_12px_#ffffff] border border-white/20">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3 drop-shadow-[1px_1px_1px_white]">Screening Questions</span>
                <ul className="list-decimal pl-4 space-y-3 text-gray-600 font-bold">
                  <li className="drop-shadow-[1px_1px_1px_white]">Describe a situation where you resolved conflict with a frustrated customer.</li>
                  <li className="drop-shadow-[1px_1px_1px_white]">How do you handle high call volumes while remaining warm and positive?</li>
                  <li className="drop-shadow-[1px_1px_1px_white]">What are your expected salary bounds for this position?</li>
                </ul>
              </div>

              <div className="bg-[#e0e5ec] rounded-2xl p-5 shadow-[inset_6px_6px_12px_#b8bec7,inset_-6px_-6px_12px_#ffffff] border border-white/20 flex justify-between items-center">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1 drop-shadow-[1px_1px_1px_white]">Model Engine</span>
                  <span className="text-gray-700 font-bold font-mono drop-shadow-[1px_1px_1px_white]">Gemini 2.5 Flash</span>
                </div>
                <span className="px-3 py-1.5 rounded-xl bg-[#e0e5ec] text-indigo-600 text-[10px] font-extrabold shadow-[4px_4px_8px_#b8bec7,-4px_-4px_8px_#ffffff] border border-white/50">
                  Realtime API
                </span>
              </div>

              <div className="bg-[#e0e5ec] rounded-2xl p-5 shadow-[inset_6px_6px_12px_#b8bec7,inset_-6px_-6px_12px_#ffffff] border border-white/20 flex justify-between items-center">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1 drop-shadow-[1px_1px_1px_white]">Voice Tone</span>
                  <span className="text-gray-700 font-extrabold drop-shadow-[1px_1px_1px_white]">Puck (Human-like, Clear)</span>
                </div>
                <span className="px-3 py-1.5 rounded-xl bg-[#e0e5ec] text-emerald-600 text-[10px] font-extrabold shadow-[4px_4px_8px_#b8bec7,-4px_-4px_8px_#ffffff] border border-white/50">
                  Active
                </span>
              </div>
            </div>
          </div>
          <div className="text-[10px] text-gray-500 mt-8 text-center pt-4 font-mono font-bold shadow-[inset_0_2px_4px_-2px_#b8bec7] rounded-b-xl drop-shadow-[1px_1px_1px_white]">
            Agent ID: d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d22
          </div>
        </div>

        {/* Right Column: Claritiy Voice AI Panel */}
        <div className="bg-[#e0e5ec] rounded-[32px] p-8 shadow-[12px_12px_24px_#b8bec7,-12px_-12px_24px_#ffffff] text-center relative flex flex-col justify-between border border-white/50">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/80 to-transparent"></div>
          <div>
            <div className="h-2 w-20 bg-emerald-500 rounded-full mx-auto mb-6 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.5),0_0_10px_#10B981]" />

            <h1 className="text-3xl font-black mb-2 tracking-tight text-gray-700 drop-shadow-[1px_2px_2px_white]">
              Claritiy Voice
            </h1>
            <p className="text-sm text-gray-500 font-bold mb-8 drop-shadow-[1px_1px_1px_white]">Automated HR Screening Arena</p>

            <div className="flex flex-col gap-6 text-left">
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-gray-500 mb-3 drop-shadow-[1px_1px_1px_white]">
                  Candidate Phone Number (E.164)
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+91XXXXXXXXXX"
                  className="w-full bg-[#e0e5ec] rounded-2xl p-4 text-sm font-bold font-mono text-gray-700 shadow-[inset_6px_6px_12px_#b8bec7,inset_-6px_-6px_12px_#ffffff] border-none outline-none focus:ring-2 focus:ring-emerald-400/50 transition-all box-border"
                />
              </div>

              <div className="mt-2">
                {['ringing', 'connected'].includes(callStatus) ? (
                  <button
                    onClick={handleHangUp}
                    disabled={dialing}
                    className="w-full p-4 bg-red-500 hover:bg-red-600 text-white border-none rounded-2xl text-sm font-black cursor-pointer shadow-[6px_6px_12px_#b8bec7,-6px_-6px_12px_#ffffff,inset_2px_2px_4px_rgba(255,255,255,0.4),inset_-2px_-2px_4px_rgba(0,0,0,0.2)] active:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.4),inset_-4px_-4px_8px_rgba(255,255,255,0.1)] active:translate-y-1 transition-all"
                  >
                    Hang Up Connection
                  </button>
                ) : (
                  <button
                    onClick={handleStartCall}
                    disabled={dialing}
                    className="w-full p-4 bg-emerald-500 hover:bg-emerald-600 text-white border-none rounded-2xl text-sm font-black cursor-pointer shadow-[6px_6px_12px_#b8bec7,-6px_-6px_12px_#ffffff,inset_2px_2px_4px_rgba(255,255,255,0.4),inset_-2px_-2px_4px_rgba(0,0,0,0.2)] active:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.4),inset_-4px_-4px_8px_rgba(255,255,255,0.1)] active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Initiate Live Screen Call
                  </button>
                )}
              </div>

              <div className="flex justify-between items-center bg-[#e0e5ec] rounded-2xl p-4 text-xs shadow-[inset_6px_6px_12px_#b8bec7,inset_-6px_-6px_12px_#ffffff] border border-white/20">
                <span className="text-gray-500 font-extrabold drop-shadow-[1px_1px_1px_white]">Line Status</span>
                <div className="flex items-center gap-3">
                  <div
                    className={`h-3 w-3 rounded-full shadow-[inset_1px_1px_3px_rgba(0,0,0,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.5)] ${
                      callStatus === 'connected'
                        ? 'bg-emerald-500'
                        : callStatus === 'idle'
                        ? 'bg-gray-400'
                        : 'bg-amber-500'
                    }`}
                  />
                  <strong className="text-gray-700 font-extrabold drop-shadow-[1px_1px_1px_white]">{getStatusLabel(callStatus)}</strong>
                  {callStatus === 'connected' && (
                    <span className="text-emerald-600 font-black font-mono ml-1.5 drop-shadow-[1px_1px_1px_white]">({formatSecToTime(callDuration)})</span>
                  )}
                </div>
              </div>

              <div className="mt-2">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-gray-500 mb-3 drop-shadow-[1px_1px_1px_white]">
                  Live Dialogue Transcription
                </label>
                <div className="w-full h-44 bg-[#e0e5ec] rounded-2xl p-5 shadow-[inset_6px_6px_12px_#b8bec7,inset_-6px_-6px_12px_#ffffff] overflow-y-auto flex flex-col gap-4 font-sans text-xs box-border border border-white/20">
                  {transcripts.length === 0 ? (
                    <div className="text-gray-500 font-bold text-center italic my-auto drop-shadow-[1px_1px_1px_white]">
                      Dialogue streams will render here in real-time...
                    </div>
                  ) : (
                    transcripts.map((t) => (
                      <div key={t.id} className="flex flex-col gap-1.5">
                        <span
                          className={`font-black tracking-wider uppercase text-[10px] drop-shadow-[1px_1px_1px_white] ${
                            t.speaker === 'agent' ? 'text-indigo-600' : 'text-emerald-600'
                          }`}
                        >
                          {t.speaker === 'agent' ? 'Claritiy Recruiter' : 'Candidate'}
                        </span>
                        <p className="text-gray-700 m-0 leading-relaxed font-bold drop-shadow-[1px_1px_1px_white] bg-[#e0e5ec] p-3 rounded-xl shadow-[4px_4px_8px_#b8bec7,-4px_-4px_8px_#ffffff]">{t.text}</p>
                      </div>
                    ))
                  )}
                  <div ref={scrollRef} />
                </div>
              </div>
            </div>
          </div>

          {/* SIP Trunking panel */}
          <div className="mt-10 pt-6 shadow-[inset_0_2px_4px_-2px_#b8bec7] flex justify-between items-center text-left rounded-b-xl px-2">
            <div>
              <span className="block text-xs font-extrabold text-gray-700 mb-1 drop-shadow-[1px_1px_1px_white]">Outbound Calling Engine</span>
              <span className="block text-[10px] font-bold text-gray-500 drop-shadow-[1px_1px_1px_white]">Default: Vobiz Carrier</span>
            </div>
            
            <button
              onClick={() => setIsSipModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black text-emerald-600 bg-[#e0e5ec] shadow-[6px_6px_12px_#b8bec7,-6px_-6px_12px_#ffffff] hover:shadow-[inset_2px_2px_4px_#b8bec7,inset_-2px_-2px_4px_#ffffff] transition-all border border-white/50 active:translate-y-1"
            >
              <Settings2 className="w-4 h-4 drop-shadow-[1px_1px_1px_white]" />
              <span className="drop-shadow-[1px_1px_1px_white]">Configure SIP</span>
            </button>
          </div>
        </div>
      </div>

      <SipSettingsModal
        isOpen={isSipModalOpen}
        onClose={() => setIsSipModalOpen(false)}
        onSave={handleConnectSipTrunk}
      />

      <footer className="mt-16 py-8 border-t border-gray-200 text-center text-sm text-gray-500 w-full flex-shrink-0">
        <p className="mb-2">© 2026 Claritiy Voice. All rights reserved.</p>
        <div className="flex justify-center gap-4">
          <a href="/privacy" className="hover:text-emerald-600 hover:underline">Privacy Policy</a>
          <a href="/terms" className="hover:text-emerald-600 hover:underline">Terms of Service</a>
        </div>
      </footer>
    </div>
  );
}
