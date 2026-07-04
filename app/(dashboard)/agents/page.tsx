'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  Bot,
  Sliders,
  Play,
  Save,
  Plus,
  Loader2,
  Phone,
  PhoneOff,
  Activity,
  Clock,
  User,
  AlertTriangle,
  Cpu,
  Calendar,
  Layers,
  ChevronRight,
  GitBranch,
  Volume2,
  FileText,
  HelpCircle,
  Database,
  ArrowRight,
  Sparkles,
  Link2,
  ShieldAlert
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const API_BASE_URL = 'http://localhost:3001';
const WS_BASE_URL = 'ws://localhost:3001';

const VOICE_MODELS = [
  { id: 'Aoede', name: 'Aoede (Acoustic)', desc: 'High pitch female speaker' },
  { id: 'Puck', name: 'Puck (Default)', desc: 'Warm male speaker' },
  { id: 'Charon', name: 'Charon (Technical)', desc: 'Deep professional male' },
  { id: 'Fenrir', name: 'Fenrir (Energetic)', desc: 'Crisp energetic male' },
  { id: 'Kore', name: 'Kore (Calm)', desc: 'Soft gentle female' }
];

interface Agent {
  id: string;
  name: string;
  description: string;
  agentConfig: string; // JSON string
  temperature?: number;
  systemPrompt?: string;
  voiceName?: string;
  status: string;
}

interface Transcript {
  id: string;
  speaker: string;
  text: string;
  timestamp: number;
}

export default function AgentsPage() {
  const { data: session } = useSession();

  // Agent attributes
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [name, setName] = useState<string>('Delhi Intake Agent');
  const [description, setDescription] = useState<string>('Handles multi-industry inquiries');
  const [selectedVoice, setSelectedVoice] = useState<string>('Puck');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [instructions, setInstructions] = useState<string>(
    'You are Priya, a customer service assistant. You qualify caller requests, answer FAQs about products, and schedule follow-ups.'
  );

  // Studio states
  const [autoSchedule, setAutoSchedule] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('agent-settings');

  // Call states
  const [phoneNumber, setPhoneNumber] = useState<string>('+919876543210');
  const [callStatus, setCallStatus] = useState<string>('idle');
  const [duration, setDuration] = useState<number>(0);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [callId, setCallId] = useState<string | null>(null);

  // UX states
  const [loading, setLoading] = useState<boolean>(false);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  // Load agents on startup
  useEffect(() => {
    fetchAgents();
  }, []);

  // Timer counter for call
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (['connected', 'in_progress'].includes(callStatus)) {
      timer = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [callStatus]);

  // Scroll to log bottom on updates
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const fetchAgents = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v2/agents`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setAgents(json.data);
          // Auto select first agent if present
          if (json.data.length > 0 && !selectedAgentId) {
            loadAgentToForm(json.data[0]);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching agents:', err);
    }
  };

  const loadAgentToForm = (agent: Agent) => {
    setSelectedAgentId(agent.id);
    setName(agent.name);
    setDescription(agent.description || '');
    
    // Attempt to extract configuration payload
    try {
      const config = JSON.parse(agent.agentConfig || '{}');
      setSelectedVoice(agent.voiceName || config.voiceName || 'Puck');
      setTemperature(agent.temperature ?? config.temperature ?? 0.7);
      setInstructions(agent.systemPrompt || config.systemPrompt || '');
      if (config.tools && Array.isArray(config.tools)) {
        setAutoSchedule(config.tools.some((t: any) => t.name === 'auto_schedule_calendar'));
      }
    } catch {
      setSelectedVoice('Puck');
      setTemperature(0.7);
      setInstructions('');
    }
  };

  const handleCreateNew = () => {
    setSelectedAgentId('');
    setName('New Multi-Industry Agent');
    setDescription('Intake, screening, scheduling operations');
    setSelectedVoice('Puck');
    setTemperature(0.7);
    setInstructions('You are Priya, a customer service assistant. You qualify caller requests, answer FAQs, and schedule bookings.');
    setAutoSchedule(true);
  };

  const handleSaveAgent = async () => {
    setLoading(true);
    
    // Setup target tools
    const tools = [];
    if (autoSchedule) {
      tools.push({
        name: 'auto_schedule_calendar',
        description: 'Auto-Schedule Calendar integration tool',
        parameters: {
          type: 'OBJECT',
          properties: {
            bookingTime: { type: 'STRING', description: 'Target date/time ISO format for booking reservation' }
          },
          required: ['bookingTime']
        }
      });
    }

    const payload = {
      name,
      description,
      voiceName: selectedVoice,
      temperature,
      systemPrompt: instructions,
      agentConfig: JSON.stringify({
        voiceName: selectedVoice,
        temperature,
        systemPrompt: instructions,
        tools
      })
    };

    try {
      const url = selectedAgentId 
        ? `${API_BASE_URL}/api/v2/agents/${selectedAgentId}`
        : `${API_BASE_URL}/api/v2/agents`;
      const method = selectedAgentId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to save agent configuration.');

      const json = await res.json();
      if (json.success && json.data) {
        showNotification('success', 'Agent configuration updated successfully.');
        await fetchAgents();
        if (!selectedAgentId) {
          loadAgentToForm(json.data);
        }
      }
    } catch (err) {
      console.error(err);
      showNotification('error', 'Failed to save configuration schema.');
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
            const last = prev[prev.length - 1];
            if (last && last.speaker === data.speaker && !data.isFinal) {
              return [...prev.slice(0, -1), {
                id: last.id,
                speaker: data.speaker,
                text: data.text,
                timestamp: Date.now()
              }];
            } else {
              return [...prev, {
                id: `t-${Date.now()}-${Math.random()}`,
                speaker: data.speaker,
                text: data.text,
                timestamp: Date.now()
              }];
            }
          });
        } else if (data.event === 'interrupted') {
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
      case 'completed': return 'bg-slate-100 border-slate-200 text-slate-655';
      case 'failed': return 'bg-rose-50 border-rose-200 text-rose-800';
      default: return 'bg-slate-50 border-slate-200 text-slate-600';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10 bg-white">
      
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-200">
              <Bot className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2 font-sans">
                Voice Configuration Studio
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
              className="bg-white border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 max-w-[200px] cursor-pointer"
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
            className="text-xs bg-white border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl"
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

      {/* THREE-PANEL RETELL STUDIO LAYOUT */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* PANEL 1: LEFT LAYOUT PANEL (Node Palette / Agent Details) - 3 cols */}
        <div className="xl:col-span-3 space-y-6">
          <Card className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-200 bg-slate-50/50 py-4 px-5">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-sm font-bold text-slate-800">Node Palette</CardTitle>
              </div>
              <CardDescription className="text-[10px]">Draggable pipeline assets.</CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              
              <div className="space-y-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Dialogue Nodes</span>
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-grab hover:bg-slate-100 transition-colors text-xs font-semibold text-slate-700">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    <span>Conversation Nodes</span>
                  </div>
                  <div className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-grab hover:bg-slate-100 transition-colors text-xs font-semibold text-slate-700">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    <span>Subagents Node</span>
                  </div>
                  <div className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-grab hover:bg-slate-100 transition-colors text-xs font-semibold text-slate-700">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    <span>Custom Functions</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Routing Nodes</span>
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-grab hover:bg-slate-100 transition-colors text-xs font-semibold text-slate-700">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                    <span>Call Transfers</span>
                  </div>
                  <div className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-grab hover:bg-slate-100 transition-colors text-xs font-semibold text-slate-700">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                    <span>Logic Splits</span>
                  </div>
                  <div className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-grab hover:bg-slate-100 transition-colors text-xs font-semibold text-slate-700">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                    <span>Variable Extraction</span>
                  </div>
                </div>
              </div>

              {/* Analytical metrics card */}
              <div className="p-4 bg-emerald-50/40 border border-emerald-250/50 rounded-2xl space-y-2 mt-4">
                <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-wider block">Edge Telemetry</span>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between font-semibold text-slate-700">
                    <span>Session Cost:</span>
                    <span className="text-emerald-700">$0.11/min</span>
                  </div>
                  <div className="flex justify-between font-semibold text-slate-700">
                    <span>Playout Latency:</span>
                    <span className="text-emerald-700">970-1450ms</span>
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>

        {/* PANEL 2: CENTER CANVAS PANEL (Visual Flow Workspace) - 5 cols */}
        <div className="xl:col-span-5 space-y-6">
          <Card className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden min-h-[500px] flex flex-col justify-between">
            <CardHeader className="border-b border-slate-200 bg-slate-50/50 py-4 px-5">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-sm font-bold text-slate-800">Visual Flow Workspace</CardTitle>
              </div>
              <CardDescription className="text-[10px]">Interactable conversation routing graph.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 flex-1 flex flex-col items-center justify-center relative bg-slate-50/20">
              
              {/* Graphic Flow Representation */}
              <div className="w-full max-w-xs space-y-12 relative flex flex-col items-center py-6">
                
                {/* SVG Connections */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between py-10 z-0">
                  <svg className="w-full h-full text-slate-300" viewBox="0 0 100 240" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <line x1="50" y1="20" x2="50" y2="85" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                    <line x1="50" y1="120" x2="50" y2="185" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                  </svg>
                </div>

                {/* Begin Node */}
                <div className="relative z-10 w-40 bg-white border border-slate-200 px-4 py-2.5 rounded-xl shadow-sm text-center">
                  <div className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5">Start</div>
                  <div className="text-xs font-bold text-slate-800">Begin Call</div>
                </div>

                {/* Welcome Node containing Greeting */}
                <div className="relative z-10 w-48 bg-white border border-emerald-455 px-4 py-3 rounded-2xl shadow-sm space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest">Greeting Node</span>
                    <Sparkles className="h-3 w-3 text-emerald-600" />
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-200">
                    "Hi! I'm Priya. How can I help you today?"
                  </div>
                </div>

                {/* End Call Node */}
                <div className="relative z-10 w-40 bg-white border border-slate-200 px-4 py-2.5 rounded-xl shadow-sm text-center">
                  <div className="text-[9px] font-bold text-rose-600 uppercase tracking-widest mb-0.5">Termination</div>
                  <div className="text-xs font-bold text-slate-800">End Call</div>
                </div>

              </div>

            </CardContent>
          </Card>
        </div>

        {/* PANEL 3: RIGHT SETTINGS PANEL (Global Setting System Tab Accordion) - 4 cols */}
        <div className="xl:col-span-4 space-y-6">
          <Card className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden">
            
            {/* Header Accordion Links */}
            <div className="border-b border-slate-200 bg-slate-50/50 flex text-center text-xs">
              <button 
                onClick={() => setActiveTab('agent-settings')}
                className={`flex-1 py-3.5 font-bold transition-all border-b-2 ${
                  activeTab === 'agent-settings' 
                    ? 'border-emerald-600 text-emerald-700 bg-white' 
                    : 'border-transparent text-slate-500 hover:text-slate-855'
                }`}
              >
                Configuration
              </button>
              <button 
                onClick={() => setActiveTab('playground')}
                className={`flex-1 py-3.5 font-bold transition-all border-b-2 ${
                  activeTab === 'playground' 
                    ? 'border-emerald-600 text-emerald-700 bg-white' 
                    : 'border-transparent text-slate-500 hover:text-slate-855'
                }`}
              >
                Testing Dialer
              </button>
            </div>

            {/* TAB CONTENT: Agent Settings / Speech Config */}
            {activeTab === 'agent-settings' && (
              <CardContent className="p-6 space-y-5">
                
                {/* Agent settings */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Agent Name</label>
                    <Input 
                      value={name} 
                      onChange={(e) => setName(e.target.value)}
                      className="bg-white border-slate-200 focus-visible:ring-emerald-500 text-xs text-slate-855 rounded-xl"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Agent Subtitle</label>
                    <Input 
                      value={description} 
                      onChange={(e) => setDescription(e.target.value)}
                      className="bg-white border-slate-200 focus-visible:ring-emerald-500 text-xs text-slate-855 rounded-xl"
                    />
                  </div>

                  {/* Speech Settings: Voice Models selection */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Voice Models</label>
                    <div className="grid grid-cols-2 gap-2">
                      {VOICE_MODELS.map((model) => {
                        const isSelected = selectedVoice.toLowerCase() === model.id.toLowerCase();
                        return (
                          <div
                            key={model.id}
                            onClick={() => setSelectedVoice(model.id)}
                            className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                              isSelected 
                                ? 'bg-emerald-50/50 border-emerald-500 text-emerald-800 font-bold scale-[1.01]' 
                                : 'bg-white border-slate-200 hover:border-slate-355 text-slate-600 hover:text-slate-800'
                            }`}
                          >
                            <span className="text-xs font-bold block truncate">{model.id}</span>
                            <span className="text-[9px] text-slate-400 block truncate">{model.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Temperature slider */}
                  <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
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
                  </div>

                  {/* System instruction textarea */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">System Instructions</label>
                    <textarea
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      rows={6}
                      className="w-full rounded-xl border border-slate-200 bg-white text-xs text-slate-700 p-3 outline-none focus:border-emerald-500 transition-colors font-mono resize-none stable-scrollbar"
                    />
                  </div>

                  {/* Auto Schedule Switch */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-emerald-600" /> Auto-Schedule Calendar Tool
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoSchedule}
                        onChange={(e) => setAutoSchedule(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-400 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  {/* Save Trigger Button */}
                  <Button
                    onClick={handleSaveAgent}
                    disabled={loading}
                    className="w-full bg-emerald-600 hover:bg-emerald-555 text-white font-semibold py-5 rounded-2xl text-xs tracking-wider uppercase transition-all shadow-sm flex justify-center items-center gap-1.5"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" /> Save Configuration
                      </>
                    )}
                  </Button>

                </div>

              </CardContent>
            )}

            {/* TAB CONTENT: Testing Dialer Playground */}
            {activeTab === 'playground' && (
              <CardContent className="p-6 space-y-4">
                
                {/* Phone playground dialer */}
                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Telephony Dialer (E.164)</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+919876543210"
                        className="pl-9 bg-white border-slate-200 text-xs text-slate-800 rounded-xl focus-visible:ring-emerald-500 focus-visible:ring-offset-0 focus-visible:border-emerald-500"
                      />
                      <Phone className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>

                    {['initiating', 'ringing', 'connected', 'in_progress'].includes(callStatus) ? (
                      <Button
                        onClick={handleHangUp}
                        variant="destructive"
                        className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-4 rounded-xl"
                      >
                        <PhoneOff className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        onClick={handleInitiateCall}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 font-bold rounded-xl"
                      >
                        <Phone className="h-3.5 w-3.5 mr-1" /> Call
                      </Button>
                    )}
                  </div>
                </div>

                {/* Live transcript status bar */}
                <div className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${getStatusColor(callStatus)}`}>
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
                  <div className="h-72 rounded-2xl border border-slate-200 bg-white p-4 overflow-y-auto space-y-3.5 stable-scrollbar">
                    {transcripts.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
                        {['initiating', 'ringing', 'connected', 'in_progress'].includes(callStatus) ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                            <span className="text-xs font-semibold text-slate-500">Awaiting audio delta stream...</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="h-5 w-5 text-slate-300" />
                            <span className="text-xs font-semibold">No active call transcript.</span>
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
                                ? 'bg-slate-55 bg-slate-50 border-slate-200 text-slate-700 rounded-bl-none'
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
            )}

          </Card>
        </div>

      </div>

    </div>
  );
}
