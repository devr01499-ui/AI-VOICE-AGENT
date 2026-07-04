'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Bot,
  Plus,
  Activity,
  Save,
  Phone,
  PhoneOff,
  User,
  Sliders,
  Settings,
  AlertTriangle,
  Zap,
  Clock,
  Cpu,
  Loader2,
  Calendar,
} from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  description: string | null;
  agentType: string;
  status: string;
  agentConfig: any;
}

interface TranscriptItem {
  id: string;
  speaker: 'user' | 'agent' | 'system';
  text: string;
  timestamp: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://ai-voice-agent-backend-mv32.onrender.com');

const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');

const DEFAULT_INSTRUCTIONS = 
  "You are Priya, a friendly, professional AI HR Recruiter from Delhi Tech Careers calling about a Software Engineer job opening. " +
  "Your task is to pre-qualify the candidate's technical stack (specifically React and TypeScript experience). " +
  "You must keep all your responses extremely concise—strictly under 2 sentences per turn. " +
  "Permit yourself to use occasional conversational fillers at the beginning of a sentence (e.g., 'Got it...', 'Ah, interesting...', 'Right...', 'Ok...'). " +
  "Use commas (,) and ellipsis (...) cleanly inside your replies to introduce natural micro-pauses so that the text-to-speech engine speaks with realistic breathing points and pitch changes.";

const VOICE_MODELS = [
  { id: 'Aoede', name: 'Aoede (Femme Shimmer)', desc: 'Clear, high-frequency optimized prebuilt voice' },
  { id: 'Puck', name: 'Puck (Neutral Alloy)', desc: 'Standard energetic balanced voice' },
  { id: 'Charon', name: 'Charon (Deep Echo)', desc: 'Warm resonant baritone voice' },
  { id: 'Fenrir', name: 'Fenrir (Crisp Fable)', desc: 'Highly clear, pacing-optimized tone' },
  { id: 'Kore', name: 'Kore (Smooth Onyx)', desc: 'Professional, calm business voice' },
];

export default function AgentsPage() {
  // Agent state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [name, setName] = useState<string>('Priya HR Agent');
  const [description, setDescription] = useState<string>('HR screening recruiter for tech talent');
  const [selectedVoice, setSelectedVoice] = useState<string>('Fenrir');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [instructions, setInstructions] = useState<string>(DEFAULT_INSTRUCTIONS);
  const [autoSchedule, setAutoSchedule] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Playground call state
  const [phoneNumber, setPhoneNumber] = useState<string>('+919876543210');
  const [callId, setCallId] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<string>('idle'); // idle, initiating, ringing, connected, completed, failed
  const [duration, setDuration] = useState<number>(0);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch agents on mount
  useEffect(() => {
    fetchAgents();
    return () => {
      stopCallMonitoring();
    };
  }, []);

  // Autoscroll conversation log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  // Duration counter timer
  useEffect(() => {
    if (callStatus === 'connected' || callStatus === 'in_progress') {
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/v2/agents`);
      const json = await res.json();
      if (json.success && json.data) {
        setAgents(json.data);
        if (json.data.length > 0) {
          loadAgentToForm(json.data[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching agents:', err);
      showNotification('error', 'Could not load agents list from backend server.');
    } finally {
      setLoading(false);
    }
  };

  const loadAgentToForm = (agent: Agent) => {
    setSelectedAgentId(agent.id);
    setName(agent.name);
    setDescription(agent.description || '');
    
    // Load configs
    let config = agent.agentConfig;
    if (typeof config === 'string') {
      try {
        config = JSON.parse(config);
      } catch {
        config = {};
      }
    }
    
    setSelectedVoice(config.voice || 'Fenrir');
    setTemperature(config.temperature ?? config.llm_config?.temperature ?? 0.7);
    setInstructions(config.prompt || config.system_prompt || DEFAULT_INSTRUCTIONS);
    
    // Parse tools config
    const hasAutoSchedule = Array.isArray(config.tools) && 
      config.tools.some((t: any) => t.name === 'auto_schedule');
    setAutoSchedule(hasAutoSchedule);
  };

  const handleCreateNew = () => {
    setSelectedAgentId('');
    setName('New Recruiter Personal');
    setDescription('Hiring screening voice agent');
    setSelectedVoice('Fenrir');
    setTemperature(0.7);
    setInstructions(DEFAULT_INSTRUCTIONS);
    setAutoSchedule(false);
    showNotification('success', 'Workspace cleared. Ready to design new agent.');
  };

  const showNotification = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSaveAgent = async () => {
    try {
      setLoading(true);
      const toolsArray = autoSchedule ? [
        {
          name: 'auto_schedule',
          description: 'Automatically schedules an interview in the calendar.',
          parameters: {
            type: 'object',
            properties: {
              dateTime: {
                type: 'string',
                description: 'The date and time for the interview in ISO format (e.g. 2026-07-04T15:00:00Z)'
              },
              candidateName: {
                type: 'string',
                description: 'The name of the candidate'
              }
            },
            required: ['dateTime', 'candidateName']
          },
          executionType: 'builtin',
          config: {}
        }
      ] : [];

      const payload = {
        name,
        description,
        agentType: 'conversational',
        status: 'active',
        agentConfig: {
          voice: selectedVoice,
          prompt: instructions,
          llm: {
            provider: 'gemini',
            model: 'gemini-2.0-flash',
            temperature: temperature
          },
          llm_config: {
            model: 'gemini-2.0-flash',
            temperature: temperature
          },
          temperature: temperature,
          tools: toolsArray
        },
        tags: []
      };

      const url = selectedAgentId 
        ? `${API_BASE_URL}/api/v2/agents/${selectedAgentId}`
        : `${API_BASE_URL}/api/v2/agents`;
      
      const method = selectedAgentId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('API server rejected the payload');

      const json = await res.json();
      if (json.success) {
        showNotification('success', `Agent '${name}' saved successfully in SQLite database!`);
        fetchAgents();
      }
    } catch (err) {
      console.error('Error saving agent:', err);
      showNotification('error', 'Failed to save agent config. Check server status.');
    } finally {
      setLoading(false);
    }
  };

  // Call playground operations
  const handleInitiateCall = async () => {
    if (!selectedAgentId) {
      showNotification('error', 'Please configure and save an agent first.');
      return;
    }
    
    try {
      setCallStatus('initiating');
      setTranscripts([]);
      setDuration(0);
      setCallId(null);

      const res = await fetch(`${API_BASE_URL}/api/v2/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          agentId: selectedAgentId,
          userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', // Seeded dev user ID
          userData: { source: 'dashboard-play-ws' }
        })
      });

      if (!res.ok) throw new Error('Could not initiate SIP call request');

      const json = await res.json();
      if (json.success && json.data) {
        const cId = json.data.callId;
        setCallId(cId);
        setCallStatus(json.data.status); // ringing / initiating
        
        // Start monitoring WebSocket & HTTP status
        startCallMonitoring(cId);
      }
    } catch (err) {
      console.error('Error dialing:', err);
      showNotification('error', 'Failed to dial call playground connection.');
      setCallStatus('failed');
    }
  };

  const handleHangUp = async () => {
    if (!callId) return;
    try {
      await fetch(`${API_BASE_URL}/api/v2/calls/${callId}/terminate`, { method: 'POST' });
      setCallStatus('completed');
      stopCallMonitoring();
    } catch (err) {
      console.error('Error terminating call:', err);
    }
  };

  const startCallMonitoring = (cId: string) => {
    stopCallMonitoring();

    // 1. WebSocket stream subscription
    const wsUrl = `${WS_BASE_URL}/live-transcript?callId=${cId}`;
    console.log('Connecting to WebSocket transcript stream:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      console.log('WebSocket stream established.');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'transcript') {
          setTranscripts((prev) => {
            // Check if we can group delta segments or push new lines
            const last = prev[prev.length - 1];
            if (last && last.speaker === data.speaker && !data.isFinal) {
              // Replace last typing segment
              return [...prev.slice(0, -1), {
                id: last.id,
                speaker: data.speaker,
                text: data.text,
                timestamp: Date.now()
              }];
            } else {
              // Append new transcript bubble
              return [...prev, {
                id: `t-${Date.now()}-${Math.random()}`,
                speaker: data.speaker,
                text: data.text,
                timestamp: Date.now()
              }];
            }
          });
        } else if (data.event === 'interrupted') {
          // Append interruption visual indicator
          setTranscripts((prev) => [
            ...prev,
            {
              id: `int-${Date.now()}`,
              speaker: 'system',
              text: '⚠️ AI speech interrupted by user response',
              timestamp: Date.now()
            }
          ]);
        }
      } catch (e) {
        console.error('Error parsing transcript websocket packet:', e);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      console.log('WebSocket stream closed.');
    };

    ws.onerror = (e) => {
      console.error('WebSocket stream error:', e);
    };

    // 2. HTTP Polling fallback for status updates
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v2/calls/${cId}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            const status = json.data.status;
            setCallStatus(status);
            
            const terminalStates = ['completed', 'failed', 'no_answer', 'busy', 'cancelled'];
            if (terminalStates.includes(status)) {
              stopCallMonitoring();
            }
          }
        }
      } catch (e) {
        console.error('Polling status error:', e);
      }
    }, 1500);
  };

  const stopCallMonitoring = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setWsConnected(false);
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
      case 'cancelled': return 'Terminated';
      default: return 'Online Playground';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ringing': return 'bg-amber-50 border-amber-200 text-amber-800 animate-pulse';
      case 'connected':
      case 'in_progress': return 'bg-emerald-50 border-emerald-200 text-emerald-800';
      case 'completed': return 'bg-slate-100 border-slate-200 text-slate-600';
      case 'failed': return 'bg-rose-50 border-rose-200 text-rose-800';
      default: return 'bg-slate-50 border-slate-200 text-slate-600';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10 bg-white">
      
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-50 rounded-lg text-emerald-600 border border-emerald-200">
              <Bot className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
                HR Voice Configuration Studio
              </h1>
              <p className="text-slate-500 text-xs mt-0.5">
                Refactored visual pipeline manager. Syncs custom agent configuration directly to SQLite/Postgres.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {agents.length > 0 && (
            <select
              value={selectedAgentId}
              onChange={(e) => {
                const found = agents.find((a) => a.id === e.target.value);
                if (found) loadAgentToForm(found);
              }}
              className="bg-white border border-slate-200 text-xs text-slate-700 rounded-lg px-3 py-2 outline-none focus:border-emerald-500 max-w-[200px] cursor-pointer"
            >
              <option value="">-- Choose Agent Profiles --</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}

          <Button 
            onClick={handleCreateNew} 
            variant="outline" 
            className="text-xs bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> New Persona
          </Button>
        </div>
      </div>

      {/* Floating Status Notification Toast */}
      {message && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs leading-relaxed animate-fade-in ${
          message.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <div className="w-2 h-2 rounded-full bg-current animate-ping shrink-0" />
          <div className="flex-1">{message.text}</div>
        </div>
      )}

      {/* Main Two-Column Studio Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Agent Settings Form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
            <CardHeader className="border-b border-slate-200 bg-slate-50/50 py-4">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-emerald-600" />
                <div>
                  <CardTitle className="text-base text-slate-800">Custom Recruiter Profile</CardTitle>
                  <CardDescription className="text-xs text-slate-500">Establish the core identity and behavioral rules of the conversational agent.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              
              {/* Agent Name & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Agent Name</label>
                  <Input 
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                    className="bg-white border-slate-200 focus-visible:ring-emerald-500 text-xs text-slate-800" 
                    placeholder="e.g. Priya Tech Screener"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Short Subtitle</label>
                  <Input 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-white border-slate-200 focus-visible:ring-emerald-500 text-xs text-slate-800" 
                    placeholder="e.g. Pre-qualifies React engineers"
                  />
                </div>
              </div>

              {/* Target Voice Selection Cards */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Voice Models Selection</label>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                  {VOICE_MODELS.map((model) => {
                    const isSelected = selectedVoice.toLowerCase() === model.id.toLowerCase();
                    return (
                      <div
                        key={model.id}
                        onClick={() => setSelectedVoice(model.id)}
                        className={`p-3 rounded-lg border text-left cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                          isSelected 
                            ? 'bg-emerald-50/50 border-emerald-500 text-emerald-800 font-bold scale-[1.02]' 
                            : 'bg-white border-slate-200 hover:border-slate-355 text-slate-600 hover:text-slate-855'
                        }`}
                        title={model.desc}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Cpu className={`h-4 w-4 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-600 animate-pulse' : 'bg-slate-200'}`} />
                        </div>
                        <div>
                          <span className="text-xs font-bold block truncate">{model.id}</span>
                          <span className="text-[9px] text-slate-400 block truncate mt-0.5">{model.name.split(' ')[0]}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Slider: Temperature */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">LLM Temperature</span>
                  <span className="text-emerald-700 font-mono font-bold">{temperature.toFixed(1)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400 font-mono">0.0</span>
                  <input
                    type="range"
                    min="0.0"
                    max="2.0"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 font-mono">2.0</span>
                </div>
                <p className="text-[9px] text-slate-500 italic mt-1 leading-normal">
                  Higher levels promote creativity, while lower values restrict model hallucination risks on qualification parameters.
                </p>
              </div>

              {/* Textarea: Prompt engineering */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">System Instructions & Prompt Engineering Scripts</label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={8}
                  className="w-full rounded-lg border border-slate-200 bg-white text-xs text-slate-700 p-4 outline-none focus:border-emerald-500 transition-colors leading-relaxed font-mono resize-none stable-scrollbar"
                  placeholder="Insert hiring pre-qualification instruction scripts here..."
                />
              </div>

              {/* Save Trigger Button */}
              <Button
                onClick={handleSaveAgent}
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-555 text-white font-semibold py-5 rounded-lg text-xs tracking-wider uppercase transition-all shadow-sm flex justify-center items-center gap-1.5"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving Workspace Config...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" /> Save Agent & Configuration Schema
                  </>
                )}
              </Button>

            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Automation & Testing Playground (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Section: Live Playground Card */}
          <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
            <CardHeader className="border-b border-slate-200 bg-slate-50/50 py-4">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-emerald-600" />
                <div>
                  <CardTitle className="text-base text-slate-800">Live Automation Platform</CardTitle>
                  <CardDescription className="text-xs text-slate-500">Bind scheduling tools and dial candidates over live SIP WebSocket lines.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              
              {/* Automation switches */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Automation Capabilities Matrix</label>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-emerald-600" /> Auto-Schedule Calendar Tool
                    </span>
                    <span className="text-[10px] text-slate-500 block leading-tight">
                      Injects calendar scheduling tool schema declarations dynamically.
                    </span>
                  </div>
                  
                  {/* Custom Toggle Switch */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoSchedule}
                      onChange={(e) => setAutoSchedule(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-355 after:border-slate-355 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>

              {/* Phone playground dialer */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Telephony Dialer (E.164)</label>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <Clock className="h-3 w-3" />
                    <span>Mock trigger fallback support</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+919876543210"
                      className="pl-9 bg-white border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus-visible:ring-emerald-500 focus-visible:ring-offset-0 focus-visible:border-emerald-500"
                    />
                    <Phone className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>

                  {['initiating', 'ringing', 'connected', 'in_progress'].includes(callStatus) ? (
                    <Button
                      onClick={handleHangUp}
                      variant="destructive"
                      className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-4"
                    >
                      <PhoneOff className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleInitiateCall}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 font-bold"
                    >
                      <Phone className="h-3.5 w-3.5 mr-1" /> Call
                    </Button>
                  )}
                </div>
              </div>

              {/* Live transcript status bar */}
              <div className={`p-3 rounded-lg border text-xs flex items-center justify-between transition-all ${getStatusColor(callStatus)}`}>
                <div className="flex items-center gap-2 font-semibold">
                  <div className={`w-2 h-2 rounded-full bg-current ${['initiating', 'ringing', 'connected', 'in_progress'].includes(callStatus) ? 'animate-ping' : ''}`} />
                  <span>{getStatusLabel(callStatus)}</span>
                </div>
                {['connected', 'in_progress'].includes(callStatus) && (
                  <span className="font-mono text-slate-800 tracking-widest">{formatSecToTime(duration)}</span>
                )}
              </div>

              {/* Live Log Monitor */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Activity className="h-3.5 w-3.5 text-emerald-600 animate-pulse" /> Live Speech Transcript Monitor
                </label>
                <div className="h-72 rounded-lg border border-slate-200 bg-white p-4 overflow-y-auto space-y-3.5 stable-scrollbar">
                  {transcripts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
                      {['initiating', 'ringing', 'connected', 'in_progress'].includes(callStatus) ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                          <span className="text-xs font-semibold text-slate-500">Awaiting audio payload delta streams...</span>
                          <span className="text-[9px] text-slate-400">WebSocket connection is active. Say hello to trigger ASR.</span>
                        </>
                      ) : (
                        <>
                          <Zap className="h-5 w-5 text-slate-355" />
                          <span className="text-xs font-semibold">No live transcript stream active.</span>
                          <span className="text-[9px]">Save your agent, dial the playground caller, and transcripts will print here.</span>
                        </>
                      )}
                    </div>
                  ) : (
                    transcripts.map((t) => {
                      if (t.speaker === 'system') {
                        return (
                          <div key={t.id} className="flex justify-center my-2">
                            <span className="px-3 py-1 bg-amber-50 border border-amber-250 text-amber-800 text-[10px] font-semibold rounded-full flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              {t.text}
                            </span>
                          </div>
                        );
                      }
                      const isAgent = t.speaker === 'agent';
                      return (
                        <div
                          key={t.id}
                          className={`flex items-end gap-2.5 max-w-[85%] animate-fade-in ${
                            isAgent ? 'mr-auto' : 'ml-auto flex-row-reverse'
                          }`}
                        >
                          <div className={`h-7 w-7 rounded-full border flex items-center justify-center shrink-0 ${
                            isAgent 
                              ? 'bg-slate-100 border-slate-200 text-slate-600' 
                              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          }`}>
                            {isAgent ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                          </div>
                          
                          <div className={`rounded-xl px-3.5 py-2 border text-xs leading-relaxed ${
                            isAgent
                              ? 'bg-slate-50 border-slate-200 text-slate-700 rounded-bl-none'
                              : 'bg-emerald-50/50 border-emerald-250 text-emerald-800 rounded-br-none shadow-sm'
                          }`}>
                            <p>{t.text}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={logEndRef} />
                </div>
              </div>

            </CardContent>
          </Card>

        </div>

      </div>

    </div>
  );
}
