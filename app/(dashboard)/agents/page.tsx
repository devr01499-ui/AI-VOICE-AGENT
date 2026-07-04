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
  ShieldAlert,
  Trash2,
  Workflow,
  MessageSquare
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

interface FlowTransition {
  condition: string;
  targetId: string;
}

interface FlowNode {
  id: string;
  type: string;
  title: string;
  message: string;
  phoneNumber?: string;
  transitions: FlowTransition[];
}

interface Agent {
  id: string;
  name: string;
  description: string;
  agentType: string; // 'prompt' | 'flow'
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

  // Agent type selector: 'prompt' vs 'flow'
  const [agentMode, setAgentMode] = useState<'prompt' | 'flow'>('prompt');

  // Agent core attributes
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [name, setName] = useState<string>('Delhi Office Receptionist');
  const [description, setDescription] = useState<string>('Dynamic Multi-Industry Inquiries Router');
  const [selectedVoice, setSelectedVoice] = useState<string>('Puck');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [instructions, setInstructions] = useState<string>(
    'You are Priya, a customer service assistant. You qualify caller requests, answer FAQs about products, and schedule follow-ups.'
  );

  // Conversational Flow node canvas state
  const [flowNodes, setFlowNodes] = useState<FlowNode[]>([
    {
      id: 'begin',
      type: 'begin',
      title: 'Begin Call',
      message: 'Trigger Call Connection',
      transitions: [{ condition: 'Handshake Success', targetId: 'welcome-node' }]
    },
    {
      id: 'welcome-node',
      type: 'conversation',
      title: 'Welcome Node',
      message: 'Hello! Thanks for calling customer support. How can I help you today?',
      transitions: [
        { condition: 'user wants to return package', targetId: 'transfer-support' },
        { condition: 'user wants to speak with live representative', targetId: 'ending-node' }
      ]
    },
    {
      id: 'transfer-support',
      type: 'call_transfer',
      title: 'Transfer Call',
      message: 'Sure, redirecting your call to our returns dispatch department.',
      phoneNumber: '+919876543210',
      transitions: []
    },
    {
      id: 'ending-node',
      type: 'ending',
      title: 'Ending Node',
      message: 'Thank you for your response. Have a great day!',
      transitions: []
    }
  ]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('welcome-node');

  // Settings & tab controllers
  const [autoSchedule, setAutoSchedule] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('agent-settings');

  // Telephony playground states
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

  // Auto compile flow-node structure to system instructions when nodes change
  useEffect(() => {
    if (agentMode === 'flow') {
      const compiled = compileFlowToInstructions(flowNodes);
      setInstructions(compiled);
    }
  }, [flowNodes, agentMode]);

  // Load agents list on startup
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

  // Scroll to transcript log bottom
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
    setAgentMode((agent.agentType === 'flow' ? 'flow' : 'prompt'));
    
    try {
      const config = JSON.parse(agent.agentConfig || '{}');
      setSelectedVoice(agent.voiceName || config.voiceName || 'Puck');
      setTemperature(agent.temperature ?? config.temperature ?? 0.7);
      setInstructions(agent.systemPrompt || config.systemPrompt || '');
      
      // Load flow nodes if saved in agentConfig
      if (agent.agentType === 'flow' && config.flowNodes) {
        setFlowNodes(config.flowNodes);
      }
      
      if (config.tools && Array.isArray(config.tools)) {
        setAutoSchedule(config.tools.some((t: any) => t.name === 'auto_schedule_calendar'));
      }
    } catch {
      setSelectedVoice('Puck');
      setTemperature(0.7);
      setInstructions('');
    }
  };

  const compileFlowToInstructions = (nodes: FlowNode[]): string => {
    let p = `You are ${name}, an advanced Conversational Voice AI agent executing a state machine graph flow.

RULES:
1. You must track your active node location in the state machine.
2. The user will speak. You must listen, respond, and evaluate if their response matches any transitions from your current node.
3. If a transition condition matches, change your current node and speak the output message of that new node.
4. If a node requires tool execution (e.g. End Call, Call Transfer, In-Call SMS), execute that tool immediately.

CURRENT GRAPH STATE MACHINE DETAILS:
`;

    for (const n of nodes) {
      p += `\n- NODE [${n.id}] (${n.type})
  Message/Speech: "${n.message}"`;
      if (n.transitions.length > 0) {
        p += `\n  Transitions:`;
        for (const t of n.transitions) {
          p += `\n    * If user intent matches: "${t.condition}" -> Transition to Node [${t.targetId}]`;
        }
      }
    }

    p += `\n\nTOOL EXECUTION PROTOCOLS:
- If you transition to a node of type "ending", you must call the tool "hang_up()".
- If you transition to a node of type "call_transfer", you must call the tool "transfer_call(phoneNumber: "${phoneNumber}")".
- If you transition to a node of type "in_call_sms", you must call the tool "send_sms(phoneNumber: "${phoneNumber}", message: "transaction status update")".

Begin at the Welcome Node (welcome-node).`;

    return p;
  };

  const handleCreateNew = () => {
    setSelectedAgentId('');
    setName('New Custom Agent');
    setDescription('Intake, screening, scheduling operations');
    setSelectedVoice('Puck');
    setTemperature(0.7);
    setInstructions('You are Priya, a customer service assistant. You qualify caller requests, answer FAQs, and schedule bookings.');
    setFlowNodes([
      {
        id: 'begin',
        type: 'begin',
        title: 'Begin Call',
        message: 'Trigger Call Connection',
        transitions: [{ condition: 'Handshake Success', targetId: 'welcome-node' }]
      },
      {
        id: 'welcome-node',
        type: 'conversation',
        title: 'Welcome Node',
        message: 'Hello! How can I help you today?',
        transitions: []
      }
    ]);
    setSelectedNodeId('welcome-node');
    setAutoSchedule(true);
  };

  const handleSaveAgent = async () => {
    setLoading(true);
    
    // Tools schema compilation
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
      agentType: agentMode,
      voiceName: selectedVoice,
      temperature,
      systemPrompt: instructions,
      agentConfig: JSON.stringify({
        voiceName: selectedVoice,
        temperature,
        systemPrompt: instructions,
        flowNodes: agentMode === 'flow' ? flowNodes : undefined,
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

    const wsUrl = `${WS_BASE_URL}/live-transcript?callId=${cId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

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
        console.error('Error parsing transcript:', e);
      }
    };

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v2/calls/${cId}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            const status = json.data.status;
            setCallStatus(status);
            if (['completed', 'failed', 'no_answer', 'busy', 'cancelled'].includes(status)) {
              stopCallMonitoring();
            }
          }
        }
      } catch (e) {
        console.error(e);
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

  // Node adjustments
  const handleUpdateNodeField = (field: keyof FlowNode, val: any) => {
    setFlowNodes((prev) =>
      prev.map((n) => (n.id === selectedNodeId ? { ...n, [field]: val } : n))
    );
  };

  const handleAddNodeTransition = () => {
    const active = flowNodes.find((n) => n.id === selectedNodeId);
    if (!active) return;
    
    const updatedTransitions = [
      ...active.transitions,
      { condition: 'user says yes', targetId: 'ending-node' }
    ];
    handleUpdateNodeField('transitions', updatedTransitions);
  };

  const handleUpdateTransition = (idx: number, field: keyof FlowTransition, val: string) => {
    const active = flowNodes.find((n) => n.id === selectedNodeId);
    if (!active) return;
    
    const updatedTransitions = active.transitions.map((t, i) =>
      i === idx ? { ...t, [field]: val } : t
    );
    handleUpdateNodeField('transitions', updatedTransitions);
  };

  const handleRemoveTransition = (idx: number) => {
    const active = flowNodes.find((n) => n.id === selectedNodeId);
    if (!active) return;
    
    const updatedTransitions = active.transitions.filter((_, i) => i !== idx);
    handleUpdateNodeField('transitions', updatedTransitions);
  };

  const handleAddCanvasNode = (type: string) => {
    const newId = `${type}-${Date.now()}`;
    const newNode: FlowNode = {
      id: newId,
      type,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
      message: type === 'ending' ? 'Thank you for your time. Goodbye!' : 'Message text template prompt...',
      transitions: []
    };
    setFlowNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newId);
  };

  const handleDeleteCanvasNode = (id: string) => {
    if (id === 'begin' || id === 'welcome-node') {
      showNotification('error', 'Cannot delete primary root nodes.');
      return;
    }
    setFlowNodes((prev) => prev.filter((n) => n.id !== id));
    setSelectedNodeId('welcome-node');
  };

  const activeNode = flowNodes.find((n) => n.id === selectedNodeId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10 bg-white">
      
      {/* Top Header Row with Mode Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-200">
        <div className="flex items-center gap-3">
          <span className="p-2 bg-emerald-555 rounded-2xl text-white">
            <Workflow className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2 font-sans">
              Voice Agent Configuration Studio
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">
              Select your design mode: simple instructions prompt, or visual state transitions canvas flow.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Method Selectors */}
          <div className="flex border border-slate-200 bg-white p-1 rounded-xl">
            <button
              onClick={() => setAgentMode('prompt')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                agentMode === 'prompt' 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Prompt-Based
            </button>
            <button
              onClick={() => setAgentMode('flow')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                agentMode === 'flow' 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Flow-Wise Canvas
            </button>
          </div>

          {agents.length > 0 && (
            <select
              value={selectedAgentId}
              onChange={(e) => {
                const found = agents.find((a) => a.id === e.target.value);
                if (found) loadAgentToForm(found);
              }}
              className="bg-white border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 max-w-[200px]"
            >
              <option value="">-- Choose Profile --</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.agentType})
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

      {/* ──────────────────────────────────────────────────────── */}
      {/* 1. SIMPLE PROMPT MODE VIEW                              */}
      {/* ──────────────────────────────────────────────────────── */}
      {agentMode === 'prompt' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-6">
            <Card className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden">
              <CardHeader className="border-b border-slate-200 bg-slate-50/50 py-4 px-6">
                <CardTitle className="text-sm font-bold text-slate-855">Prompt-Based Profile Instructions</CardTitle>
                <CardDescription className="text-xs text-slate-400">Configure global prompt instructions to direct conversational behaviors.</CardDescription>
              </CardHeader>
              
              <CardContent className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Agent Name</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white border-slate-200 rounded-xl focus-visible:ring-emerald-500 text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Description</label>
                    <Input value={description} onChange={(e) => setDescription(e.target.value)} className="bg-white border-slate-200 rounded-xl focus-visible:ring-emerald-500 text-xs" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Voice Models Selection</label>
                  <div className="grid grid-cols-5 gap-2">
                    {VOICE_MODELS.map((model) => {
                      const isSelected = selectedVoice.toLowerCase() === model.id.toLowerCase();
                      return (
                        <div
                          key={model.id}
                          onClick={() => setSelectedVoice(model.id)}
                          className={`p-3 rounded-xl border cursor-pointer text-left transition-all ${
                            isSelected ? 'bg-emerald-50/40 border-emerald-500 text-emerald-800 font-bold' : 'bg-white border-slate-200 text-slate-500'
                          }`}
                        >
                          <span className="text-xs font-bold block truncate">{model.id}</span>
                          <span className="text-[9px] text-slate-400 block truncate">{model.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">LLM Temperature</span>
                    <span className="text-emerald-700 font-mono font-bold">{temperature.toFixed(1)}</span>
                  </div>
                  <input
                    type="range" min="0.0" max="2.0" step="0.1"
                    value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Prompt Instructions Script</label>
                  <textarea
                    value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={8}
                    className="w-full rounded-xl border border-slate-200 bg-white text-xs p-4 outline-none focus:border-emerald-500 font-mono resize-none stable-scrollbar"
                  />
                </div>

                <Button onClick={handleSaveAgent} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-555 text-white font-bold py-5 rounded-2xl text-xs uppercase tracking-widest shadow-sm">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                  Save Prompt Agent
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-5 space-y-6">
            {/* Play Dialer Playground */}
            <Card className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden">
              <CardHeader className="border-b border-slate-200 bg-slate-50/50 py-4 px-6">
                <CardTitle className="text-sm font-bold text-slate-800">Testing Dialer Playground</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Telephony Dialer (E.164)</label>
                  <div className="flex gap-2">
                    <Input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="bg-white border-slate-200 rounded-xl text-xs" />
                    {['initiating', 'ringing', 'connected', 'in_progress'].includes(callStatus) ? (
                      <Button onClick={handleHangUp} variant="destructive" className="bg-rose-600 hover:bg-rose-500 rounded-xl px-4"><PhoneOff className="h-4 w-4" /></Button>
                    ) : (
                      <Button onClick={handleInitiateCall} className="bg-emerald-600 hover:bg-emerald-500 rounded-xl px-4"><Phone className="h-4 w-4 mr-1" /> Call</Button>
                    )}
                  </div>
                </div>

                <div className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${getStatusColor(callStatus)}`}>
                  <span className="font-semibold">{getStatusLabel(callStatus)}</span>
                  {['connected', 'in_progress'].includes(callStatus) && <span className="font-mono text-slate-800">{formatSecToTime(duration)}</span>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Live speech timeline</label>
                  <div className="h-64 rounded-2xl border border-slate-200 bg-white p-4 overflow-y-auto space-y-3 stable-scrollbar">
                    {transcripts.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-400 text-xs">No active logs. Click call to test.</div>
                    ) : (
                      transcripts.map((t) => (
                        <div key={t.id} className={`flex max-w-[85%] ${t.speaker === 'agent' ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}>
                          <div className={`rounded-xl px-3 py-2 border text-xs ${t.speaker === 'agent' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-emerald-50 border-emerald-250 text-emerald-800'}`}>{t.text}</div>
                        </div>
                      ))
                    )}
                    <div ref={logEndRef} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* 2. CONVERSATIONAL FLOW VISUAL CANVAS MODE VIEW          */}
      {/* ──────────────────────────────────────────────────────── */}
      {agentMode === 'flow' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* PANEL 1: LEFT LAYOUT PANEL (Node Palette / Agent Details) */}
          <div className="xl:col-span-3 space-y-6">
            <Card className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden">
              <CardHeader className="border-b border-slate-200 bg-slate-50/50 py-4 px-5">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-emerald-600" />
                  <CardTitle className="text-xs font-bold text-slate-800">Node Palette</CardTitle>
                </div>
                <CardDescription className="text-[10px]">Click list items to insert blocks onto canvas.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3.5">
                
                {/* Node insertion triggers */}
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Dialogue Nodes</span>
                  <div className="grid grid-cols-1 gap-1.5">
                    <button onClick={() => handleAddCanvasNode('conversation')} className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 hover:border-emerald-500 rounded-xl text-left text-[11px] font-semibold text-slate-700 transition-all">
                      <MessageSquare className="h-3.5 w-3.5 text-emerald-600" /> Conversation
                    </button>
                    <button onClick={() => handleAddCanvasNode('subagent')} className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 hover:border-emerald-500 rounded-xl text-left text-[11px] font-semibold text-slate-700 transition-all">
                      <Bot className="h-3.5 w-3.5 text-emerald-600" /> Subagent
                    </button>
                    <button onClick={() => handleAddCanvasNode('function')} className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 hover:border-emerald-500 rounded-xl text-left text-[11px] font-semibold text-slate-700 transition-all">
                      <Cpu className="h-3.5 w-3.5 text-emerald-600" /> Function
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Routing Tools</span>
                  <div className="grid grid-cols-1 gap-1.5">
                    <button onClick={() => handleAddCanvasNode('call_transfer')} className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 hover:border-emerald-500 rounded-xl text-left text-[11px] font-semibold text-slate-700 transition-all">
                      <Phone className="h-3.5 w-3.5 text-amber-600" /> Call Transfer
                    </button>
                    <button onClick={() => handleAddCanvasNode('in_call_sms')} className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 hover:border-emerald-500 rounded-xl text-left text-[11px] font-semibold text-slate-700 transition-all">
                      <Volume2 className="h-3.5 w-3.5 text-amber-600" /> In-Call SMS
                    </button>
                    <button onClick={() => handleAddCanvasNode('ending')} className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 hover:border-emerald-500 rounded-xl text-left text-[11px] font-semibold text-slate-700 transition-all">
                      <GitBranch className="h-3.5 w-3.5 text-rose-600" /> Ending Node
                    </button>
                  </div>
                </div>

                {/* Telemetry footer */}
                <div className="p-3 bg-emerald-50/40 border border-emerald-250/50 rounded-2xl space-y-1 mt-2 text-[11px]">
                  <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-wider block">Flow Telemetry</span>
                  <div className="flex justify-between font-semibold text-slate-600">
                    <span>Cost:</span>
                    <span className="text-emerald-700">$0.11/min</span>
                  </div>
                  <div className="flex justify-between font-semibold text-slate-600">
                    <span>Latency:</span>
                    <span className="text-emerald-700">970-1450ms</span>
                  </div>
                  <div className="flex justify-between font-semibold text-slate-600">
                    <span>Tokens:</span>
                    <span className="text-emerald-700">834 - 834</span>
                  </div>
                </div>

              </CardContent>
            </Card>
          </div>

          {/* PANEL 2: CENTER CANVAS PANEL (Visual Flow Workspace) */}
          <div className="xl:col-span-5 space-y-6">
            <Card className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden min-h-[550px] flex flex-col justify-between relative bg-slate-50/15">
              <CardHeader className="border-b border-slate-200 bg-slate-50/50 py-4 px-5 z-10 shrink-0">
                <div className="flex items-center gap-2">
                  <Workflow className="h-4 w-4 text-emerald-600" />
                  <CardTitle className="text-xs font-bold text-slate-800">Visual Flow Workspace</CardTitle>
                </div>
              </CardHeader>
              
              <CardContent className="p-6 flex-1 flex flex-col items-center overflow-y-auto space-y-8 relative py-12">
                
                {/* SVG link lines between flow elements */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between py-12 z-0">
                  <svg className="w-full h-full text-slate-200" viewBox="0 0 100 350" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <line x1="50" y1="20" x2="50" y2="330" stroke="currentColor" strokeWidth="2.5" strokeDasharray="5 5" />
                  </svg>
                </div>

                {flowNodes.map((node) => {
                  const isSelected = selectedNodeId === node.id;
                  let nodeColor = 'border-slate-200 bg-white';
                  if (node.type === 'begin') nodeColor = 'border-emerald-200 bg-emerald-50/30 text-emerald-800';
                  else if (node.type === 'ending') nodeColor = 'border-rose-250 bg-rose-50/30 text-rose-800';
                  else if (node.type === 'call_transfer') nodeColor = 'border-amber-250 bg-amber-50/30 text-amber-800';

                  return (
                    <div
                      key={node.id}
                      onClick={() => setSelectedNodeId(node.id)}
                      className={`w-64 border rounded-2xl p-4 shadow-sm relative z-10 cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-emerald-500 scale-[1.02] ring-2 ring-emerald-500/10' 
                          : 'hover:border-slate-350'
                      } ${nodeColor}`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-widest block opacity-75">{node.type}</span>
                        <div className="flex items-center gap-1">
                          {node.type !== 'begin' && node.type !== 'welcome-node' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCanvasNode(node.id);
                              }}
                              className="text-slate-400 hover:text-rose-600 transition-colors"
                              title="Delete Node"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-600 animate-pulse' : 'bg-slate-300'}`} />
                        </div>
                      </div>
                      <h4 className="text-xs font-bold text-slate-800">{node.title}</h4>
                      <p className="text-[10px] text-slate-500 truncate mt-1 leading-normal">
                        {node.message}
                      </p>
                      
                      {node.transitions.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1">
                          <span className="text-[8px] font-bold text-slate-400 uppercase block tracking-wider">Transitions</span>
                          {node.transitions.map((t, idx) => (
                            <div key={idx} className="flex justify-between items-center text-[9px] bg-slate-50 px-2 py-0.5 rounded border text-slate-500">
                              <span className="truncate max-w-[120px]">{t.condition}</span>
                              <ChevronRight className="h-3 w-3 shrink-0" />
                              <span className="font-bold truncate max-w-[60px]">{t.targetId}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

              </CardContent>
            </Card>
          </div>

          {/* PANEL 3: RIGHT SETTINGS PANEL (Global Setting System Tab Accordion) */}
          <div className="xl:col-span-4 space-y-6">
            <Card className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden">
              
              {/* Selector links */}
              <div className="border-b border-slate-200 bg-slate-50/50 flex text-center text-xs">
                <button
                  onClick={() => setActiveTab('node-settings')}
                  className={`flex-1 py-3.5 font-bold transition-all border-b-2 ${
                    activeTab === 'node-settings' 
                      ? 'border-emerald-600 text-emerald-700 bg-white' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Node Settings
                </button>
                <button
                  onClick={() => setActiveTab('global-settings')}
                  className={`flex-1 py-3.5 font-bold transition-all border-b-2 ${
                    activeTab === 'global-settings' 
                      ? 'border-emerald-600 text-emerald-700 bg-white' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Global Settings
                </button>
                <button
                  onClick={() => setActiveTab('flow-playground')}
                  className={`flex-1 py-3.5 font-bold transition-all border-b-2 ${
                    activeTab === 'flow-playground' 
                      ? 'border-emerald-600 text-emerald-700 bg-white' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Playground Test
                </button>
              </div>

              {/* TAB: Node Editor Settings */}
              {activeTab === 'node-settings' && (
                <CardContent className="p-5 space-y-4">
                  {activeNode ? (
                    <div className="space-y-4">
                      <div className="pb-3 border-b border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Active Selection</span>
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                          <Bot className="h-4.5 w-4.5 text-emerald-600" /> {activeNode.title}
                        </h3>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Node Title</label>
                        <Input
                          value={activeNode.title}
                          onChange={(e) => handleUpdateNodeField('title', e.target.value)}
                          className="bg-white border-slate-200 text-xs rounded-xl"
                        />
                      </div>

                      {activeNode.type === 'call_transfer' && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Transfer Phone Number</label>
                          <Input
                            value={activeNode.phoneNumber || ''}
                            onChange={(e) => handleUpdateNodeField('phoneNumber', e.target.value)}
                            className="bg-white border-slate-200 text-xs rounded-xl font-mono"
                          />
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Message Speech Text</label>
                        <textarea
                          value={activeNode.message}
                          onChange={(e) => handleUpdateNodeField('message', e.target.value)}
                          rows={4}
                          className="w-full rounded-xl border border-slate-200 bg-white text-xs p-3 outline-none focus:border-emerald-500 font-mono resize-none stable-scrollbar"
                        />
                      </div>

                      {/* Transitions editor */}
                      <div className="space-y-3 pt-3 border-t border-slate-100">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Outbound Transitions</label>
                          {activeNode.type !== 'ending' && activeNode.type !== 'call_transfer' && (
                            <button
                              onClick={handleAddNodeTransition}
                              className="text-[10px] text-emerald-700 hover:underline font-bold"
                            >
                              + Add Link
                            </button>
                          )}
                        </div>

                        {activeNode.transitions.length === 0 ? (
                          <div className="text-[10px] text-slate-400 italic bg-slate-50 p-3 rounded-xl text-center">No transitions linked. Node terminates conversation or loops back.</div>
                        ) : (
                          <div className="space-y-2.5">
                            {activeNode.transitions.map((t, idx) => (
                              <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 relative">
                                <button
                                  onClick={() => handleRemoveTransition(idx)}
                                  className="absolute right-2 top-2 text-slate-455 hover:text-rose-600 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>

                                <div className="space-y-1">
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Conditional Intent (NLP Match)</span>
                                  <Input
                                    value={t.condition}
                                    onChange={(e) => handleUpdateTransition(idx, 'condition', e.target.value)}
                                    className="bg-white border-slate-200 text-xs h-7 rounded-lg"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Target Node Destination</span>
                                  <select
                                    value={t.targetId}
                                    onChange={(e) => handleUpdateTransition(idx, 'targetId', e.target.value)}
                                    className="bg-white border border-slate-200 text-[10px] text-slate-700 rounded-lg px-2 py-1 outline-none w-full"
                                  >
                                    {flowNodes.map((fn) => (
                                      <option key={fn.id} value={fn.id}>
                                        {fn.title} ({fn.type})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>
                  ) : (
                    <div className="text-slate-400 text-xs text-center py-10">Select a node block from visual workspace to edit its values.</div>
                  )}
                </CardContent>
              )}

              {/* TAB: Global Settings / System Prompt compilations */}
              {activeTab === 'global-settings' && (
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Agent Name</label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white border-slate-200 text-xs rounded-xl" />
                    </div>

                    <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Voice Settings</label>
                      <select
                        value={selectedVoice}
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        className="bg-white border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-2 outline-none w-full cursor-pointer"
                      >
                        {VOICE_MODELS.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Compiled system instructions preview */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Compiled State Graph Prompt</label>
                      <textarea
                        value={instructions}
                        readOnly
                        rows={8}
                        className="w-full rounded-xl border border-slate-250 bg-slate-50 text-[10px] p-3 outline-none font-mono resize-none stable-scrollbar leading-relaxed text-slate-500"
                        title="Auto-compiled prompt schema"
                      />
                    </div>

                    {/* Save Button */}
                    <Button onClick={handleSaveAgent} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-555 text-white font-bold py-5 rounded-2xl text-xs uppercase tracking-widest shadow-sm">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                      Save Flow Graph
                    </Button>
                  </div>
                </CardContent>
              )}

              {/* TAB: Playground */}
              {activeTab === 'flow-playground' && (
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Telephony Dialer (E.164)</label>
                    <div className="flex gap-2">
                      <Input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="bg-white border-slate-200 rounded-xl text-xs" />
                      {['initiating', 'ringing', 'connected', 'in_progress'].includes(callStatus) ? (
                        <Button onClick={handleHangUp} variant="destructive" className="bg-rose-600 hover:bg-rose-500 rounded-xl px-4"><PhoneOff className="h-4 w-4" /></Button>
                      ) : (
                        <Button onClick={handleInitiateCall} className="bg-emerald-600 hover:bg-emerald-500 rounded-xl px-4"><Phone className="h-4 w-4 mr-1" /> Call</Button>
                      )}
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${getStatusColor(callStatus)}`}>
                    <span className="font-semibold">{getStatusLabel(callStatus)}</span>
                    {['connected', 'in_progress'].includes(callStatus) && <span className="font-mono text-slate-800">{formatSecToTime(duration)}</span>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Live speech timeline</label>
                    <div className="h-64 rounded-2xl border border-slate-200 bg-white p-4 overflow-y-auto space-y-3 stable-scrollbar">
                      {transcripts.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-400 text-xs">No active logs. Click call to test.</div>
                      ) : (
                        transcripts.map((t) => (
                          <div key={t.id} className={`flex max-w-[85%] ${t.speaker === 'agent' ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}>
                            <div className={`rounded-xl px-3 py-2 border text-xs ${t.speaker === 'agent' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-emerald-50 border-emerald-250 text-emerald-800'}`}>{t.text}</div>
                          </div>
                        ))
                      )}
                      <div ref={logEndRef} />
                    </div>
                  </div>
                </CardContent>
              )}

            </Card>
          </div>

        </div>
      )}

    </div>
  );
}
