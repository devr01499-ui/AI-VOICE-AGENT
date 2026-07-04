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
  MessageSquare,
  FileSpreadsheet,
  CheckCircle,
  Share2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://ai-voice-agent-backend-mv32.onrender.com');

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'ws://localhost:3001'
    : 'wss://ai-voice-agent-backend-mv32.onrender.com');

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
  type: string; // 'begin' | 'conversation' | 'logic_split' | 'call_transfer' | 'ending'
  title: string;
  message: string;
  phoneNumber?: string;
  transitions: FlowTransition[];
}

interface Agent {
  id: string;
  name: string;
  description: string;
  agentType: string; // 'prompt' | 'flow' | 'prebuilt'
  agentConfig: string; // JSON string
  flowGraph?: string; // JSON string for nodes/edges
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

interface Blueprint {
  id: string;
  title: string;
  description: string;
  voiceName: string;
  temperature: number;
  prompt: string;
  toolName: string;
  toolDesc: string;
  toolParams: any;
}

const BLUEPRINTS: Blueprint[] = [
  {
    id: 'dental',
    title: 'Dental Clinic Assistant',
    description: 'Schedule dentist appointments and manage patient slots.',
    voiceName: 'Kore',
    temperature: 0.2,
    prompt: 'You are a polite assistant for Dr. Smile Dental Clinic. Book appointment slots and verify patient names.',
    toolName: 'bookDentalAppointment',
    toolDesc: 'Book dental slot for customer.',
    toolParams: { type: 'OBJECT', properties: { appointmentTime: { type: 'STRING' } }, required: ['appointmentTime'] }
  },
  {
    id: 'hr',
    title: 'HR Recruiting screener',
    description: 'Qualify candidates and log interview bookings.',
    voiceName: 'Puck',
    temperature: 0.6,
    prompt: 'You are an HR screening assistant for Acme Corp. Schedule candidate technical interviews.',
    toolName: 'scheduleInterview',
    toolDesc: 'Schedule candidate interview.',
    toolParams: { type: 'OBJECT', properties: { candidateName: { type: 'STRING' }, interviewTime: { type: 'STRING' } }, required: ['candidateName', 'interviewTime'] }
  },
  {
    id: 'realestate',
    title: 'Real Estate Agent',
    description: 'Gather property tour bookings and coordinate visits.',
    voiceName: 'Charon',
    temperature: 0.7,
    prompt: 'You are a real estate agent scheduler. Collect tour dates for properties.',
    toolName: 'schedulePropertyTour',
    toolDesc: 'Schedule property visit.',
    toolParams: { type: 'OBJECT', properties: { propertyAddress: { type: 'STRING' }, tourTime: { type: 'STRING' } }, required: ['propertyAddress', 'tourTime'] }
  },
  {
    id: 'creditcard',
    title: 'Credit Card Processor',
    description: 'Validate transactions parameters safely.',
    voiceName: 'Fenrir',
    temperature: 0.1,
    prompt: 'You are an automated transaction screening bot. Safely verify payment parameters.',
    toolName: 'verifyCreditCard',
    toolDesc: 'Validate payment parameters.',
    toolParams: { type: 'OBJECT', properties: { cardNumberLast4: { type: 'STRING' }, billingZip: { type: 'STRING' } }, required: ['cardNumberLast4', 'billingZip'] }
  },
  {
    id: 'debt',
    title: 'Debt Recovery Collection',
    description: 'Negotiate collection repayment schedules.',
    voiceName: 'Puck',
    temperature: 0.4,
    prompt: 'You are a calm, professional collections assistant. Discuss repayment schedules politely.',
    toolName: 'logPaymentAgreement',
    toolDesc: 'Log debt recovery agreement.',
    toolParams: { type: 'OBJECT', properties: { paymentAmount: { type: 'STRING' }, agreementDate: { type: 'STRING' } }, required: ['paymentAmount', 'agreementDate'] }
  },
  {
    id: 'promo',
    title: 'Promotional Outreach',
    description: 'Introduce customer loyalty discounts.',
    voiceName: 'Aoede',
    temperature: 0.9,
    prompt: 'You are an enthusiastic brand outreach assistant. Introduce special discounts to callers.',
    toolName: 'registerPromoCode',
    toolDesc: 'Register promo discount coupon.',
    toolParams: { type: 'OBJECT', properties: { promoCode: { type: 'STRING' } }, required: ['promoCode'] }
  },
  {
    id: 'support',
    title: 'Vertical Support Desk',
    description: 'Ingest client complaints and open CRM tickets.',
    voiceName: 'Kore',
    temperature: 0.5,
    prompt: 'You are a customer care representative. Ingest customer complaints and route tickets.',
    toolName: 'createSupportTicket',
    toolDesc: 'Create support portal ticket.',
    toolParams: { type: 'OBJECT', properties: { ticketSubject: { type: 'STRING' }, urgency: { type: 'STRING' } }, required: ['ticketSubject', 'urgency'] }
  }
];

export default function AgentsPage() {
  const { data: session } = useSession();

  // Switchable generation modes: prompt | canvas | prebuilt
  const [creationMode, setCreationMode] = useState<'prompt' | 'canvas' | 'prebuilt'>('prompt');

  // Active state variables
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [name, setName] = useState<string>('Receptionist Agent');
  const [description, setDescription] = useState<string>('Custom Receptionist Operations Router');
  const [selectedVoice, setSelectedVoice] = useState<string>('Puck');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [instructions, setInstructions] = useState<string>('');

  // Mode A: Prompt Description input
  const [promptDescription, setPromptDescription] = useState<string>('A helpful dental receptionist who books appointment dates...');
  const [optimizing, setOptimizing] = useState<boolean>(false);
  const [dialing, setDialing] = useState<boolean>(false);

  // Mode B: Interactive flowGraph node editor
  const [flowNodes, setFlowNodes] = useState<FlowNode[]>([
    {
      id: 'begin',
      type: 'begin',
      title: 'Begin Call',
      message: 'Trigger Call Connection',
      transitions: [{ condition: 'Call Connected', targetId: 'welcome-node' }]
    },
    {
      id: 'welcome-node',
      type: 'conversation',
      title: 'Welcome Node',
      message: 'Hello! Welcome to our store. How can I help you today?',
      transitions: [
        { condition: 'user wants to transfer', targetId: 'transfer-node' },
        { condition: 'user wants to end call', targetId: 'ending-node' }
      ]
    },
    {
      id: 'transfer-node',
      type: 'call_transfer',
      title: 'Call Transfer',
      message: 'Transferring your call to operations routing now.',
      phoneNumber: '+919876543210',
      transitions: []
    },
    {
      id: 'ending-node',
      type: 'ending',
      title: 'Call End',
      message: 'Thank you for your response. Have a great day!',
      transitions: []
    }
  ]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('welcome-node');

  // Registered tools list (CRM scheduling template, etc.)
  const [registeredTool, setRegisteredTool] = useState<{ name: string; description: string; parameters: any } | null>(null);

  // Dialer testing playground
  const [phoneNumber, setPhoneNumber] = useState<string>('+919876543210');
  const [callStatus, setCallStatus] = useState<string>('idle');
  const [duration, setDuration] = useState<number>(0);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [callId, setCallId] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
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
      const res = await fetch(`${API_BASE_URL}/api/v2/agents`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setAgents(json.data);
          if (json.data.length > 0 && !selectedAgentId) {
            loadAgent(json.data[0]);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadAgent = (agent: Agent) => {
    setSelectedAgentId(agent.id);
    setName(agent.name);
    setDescription(agent.description || '');
    
    // Set appropriate creation mode tab
    if (agent.agentType === 'flow') {
      setCreationMode('canvas');
    } else {
      setCreationMode('prompt');
    }

    try {
      const config = JSON.parse(agent.agentConfig || '{}');
      setSelectedVoice(agent.voiceName || config.voiceName || 'Puck');
      setTemperature(agent.temperature ?? config.temperature ?? 0.7);
      setInstructions(agent.systemPrompt || config.systemPrompt || '');
      
      if (agent.flowGraph) {
        const parsedGraph = JSON.parse(agent.flowGraph);
        if (parsedGraph.nodes) setFlowNodes(parsedGraph.nodes);
      }

      if (config.tools && config.tools.length > 0) {
        setRegisteredTool(config.tools[0]);
      } else {
        setRegisteredTool(null);
      }
    } catch {
      setSelectedVoice('Puck');
      setTemperature(0.7);
      setInstructions('');
      setRegisteredTool(null);
    }
  };

  const handleCreateNew = () => {
    setSelectedAgentId('');
    setName('New Custom Agent');
    setDescription('Voice agent configured for multi-industry workflow routing');
    setSelectedVoice('Puck');
    setTemperature(0.7);
    setInstructions('You are Priya, a receptionist. Qualify caller queries and routing parameters.');
    setPromptDescription('Answering general FAQ questions and routing callers to relevant agents...');
    setFlowNodes([
      {
        id: 'begin',
        type: 'begin',
        title: 'Begin Call',
        message: 'Trigger Call Connection',
        transitions: [{ condition: 'Call Connected', targetId: 'welcome-node' }]
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
    setRegisteredTool(null);
  };

  // Mode A: Dynamic Prompt Optimizer API call
  const handleOptimizePrompt = async () => {
    if (!promptDescription.trim()) {
      showToast('error', 'Please enter a role description.');
      return;
    }
    setOptimizing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v2/agents/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: promptDescription })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setInstructions(json.data.prompt);
          setSelectedVoice(json.data.voiceName);
          setTemperature(json.data.temperature);
          showToast('success', 'Enriched instruction script successfully loaded.');
        }
      } else {
        throw new Error('Failed optimization endpoint response');
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Error optimizing prompt instructions.');
    } finally {
      setOptimizing(false);
    }
  };

  // Mode C: Blueprint Injection routine
  const handleInjectBlueprint = (bp: Blueprint) => {
    setName(bp.title);
    setDescription(bp.description);
    setSelectedVoice(bp.voiceName);
    setTemperature(bp.temperature);
    setInstructions(bp.prompt);
    
    // Initialize tool schema inside the form context state
    setRegisteredTool({
      name: bp.toolName,
      description: bp.toolDesc,
      parameters: bp.toolParams
    });

    showToast('success', `Injected blueprint template: ${bp.title}.`);
  };

  // Save Agent configuration schema (Publish Flow serializes into flowGraph)
  const handleSaveAgent = async () => {
    setLoading(true);
    
    // Autocompile flow to instructions if in canvas mode
    let compiledInstructions = instructions;
    if (creationMode === 'canvas') {
      compiledInstructions = compileFlowToInstructions(flowNodes);
    }

    const payload = {
      name,
      description,
      agentType: creationMode === 'canvas' ? 'flow' : 'conversational',
      voiceName: selectedVoice,
      temperature,
      systemPrompt: compiledInstructions,
      flowGraph: creationMode === 'canvas' ? JSON.stringify({ nodes: flowNodes }) : undefined,
      agentConfig: JSON.stringify({
        voiceName: selectedVoice,
        temperature,
        systemPrompt: compiledInstructions,
        tools: registeredTool ? [registeredTool] : []
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

      if (!res.ok) throw new Error('Failed to update database schema');

      const json = await res.json();
      if (json.success) {
        showToast('success', 'Agent Configuration schema updated successfully.');
        await fetchAgents();
        if (!selectedAgentId && json.data) {
          loadAgent(json.data);
        }
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Error writing configuration changes.');
    } finally {
      setLoading(false);
    }
  };

  const compileFlowToInstructions = (nodes: FlowNode[]): string => {
    let p = `You are a conversational state machine routing voice assistant named ${name}.
RULES:
1. You must track your active node location in the state machine.
2. The user will speak. Evaluate their intent and compare it against active transitions.
3. If intent matches, transition to target Node and speak its output message.

STATE CONFIGURATIONS:
`;
    for (const n of nodes) {
      p += `\n- NODE [${n.id}] (${n.type})
  Output message: "${n.message}"`;
      if (n.transitions && n.transitions.length > 0) {
        p += `\n  Transitions:`;
        for (const t of n.transitions) {
          p += `\n    * If intent matches: "${t.condition}" -> Transition to [${t.targetId}]`;
        }
      }
    }
    p += `\n\nTOOL EXECUTION PROTOCOLS:
- On type "ending", call "hang_up()".
- On type "call_transfer", call "transfer_call(phoneNumber: "${phoneNumber}")".

Start at the welcome-node.`;
    return p;
  };

  // Dialer pipeline
  const handleInitiateCall = async () => {
    if (!selectedAgentId) {
      showToast('error', 'Please save agent before testing.');
      return;
    }
    try {
      setDialing(true);
      setCallStatus('initiating');
      setTranscripts([]);
      setDuration(0);
      setCallId(null);

      const res = await fetch(`${API_BASE_URL}/api/calls/outbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          agentId: selectedAgentId,
          userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        })
      });

      if (!res.ok) throw new Error('Dialer trigger failed');
      const json = await res.json();
      if (json.success && json.data) {
        setCallId(json.data.callId);
        setCallStatus(json.data.status);
        startCallMonitoring(json.data.callId);
      }
    } catch (e) {
      console.error(e);
      setCallStatus('failed');
    } finally {
      setDialing(false);
    }
  };

  const handleHangUp = async () => {
    if (!callId) return;
    try {
      await fetch(`${API_BASE_URL}/api/v2/calls/${callId}/terminate`, { method: 'POST' });
      setCallStatus('completed');
      stopCallMonitoring();
    } catch (e) {
      console.error(e);
    }
  };

  const startCallMonitoring = (cId: string) => {
    stopCallMonitoring();
    const ws = new WebSocket(`${WS_BASE_URL}/live-transcript?callId=${cId}`);
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

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v2/calls/${cId}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setCallStatus(json.data.status);
            if (['completed', 'failed', 'no_answer', 'busy', 'cancelled'].includes(json.data.status)) {
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
    if (wsRef.current) wsRef.current.close();
    if (pollRef.current) clearInterval(pollRef.current);
  };

  // Canvas adjustments
  const handleUpdateNodeField = (field: keyof FlowNode, val: any) => {
    setFlowNodes((prev) => prev.map((n) => (n.id === selectedNodeId ? { ...n, [field]: val } : n)));
  };

  const handleAddCanvasNode = (type: string) => {
    const newId = `${type}-${Date.now()}`;
    const newNode: FlowNode = {
      id: newId,
      type,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Block`,
      message: type === 'ending' ? 'Call finished. Thank you.' : 'Configure message settings...',
      transitions: []
    };
    setFlowNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newId);
  };

  const handleDeleteNode = (id: string) => {
    if (id === 'begin' || id === 'welcome-node') {
      showToast('error', 'Cannot delete primary root nodes.');
      return;
    }
    setFlowNodes((prev) => prev.filter((n) => n.id !== id));
    setSelectedNodeId('welcome-node');
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ringing': return 'bg-amber-50 border-amber-250 text-amber-800 animate-pulse';
      case 'connected':
      case 'in_progress': return 'bg-emerald-50 border-emerald-250 text-emerald-800';
      case 'completed': return 'bg-slate-100 border-slate-200 text-slate-655';
      case 'failed': return 'bg-rose-50 border-rose-250 text-rose-800';
      default: return 'bg-slate-50 border-slate-200 text-slate-500';
    }
  };

  const activeNode = flowNodes.find((n) => n.id === selectedNodeId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10 bg-[#FDFBF7]">
      
      {/* Notifications toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-2xl border text-xs shadow-md animate-in fade-in duration-350 ${
          toast.type === 'success' ? 'bg-emerald-50 border-emerald-250 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {toast.text}
        </div>
      )}

      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="p-2.5 bg-emerald-600 rounded-2xl text-white">
            <Workflow className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight font-sans">
              Tri-Mode Agent Studio
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Rebuild, design, and configure voice AI configurations across three optimized creation engines.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {/* Tri-Mode Selector Tab */}
          <div className="flex border border-slate-200 bg-slate-50 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setCreationMode('prompt')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                creationMode === 'prompt' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Prompt-Base
            </button>
            <button
              onClick={() => setCreationMode('canvas')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                creationMode === 'canvas' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Canvas Flow
            </button>
            <button
              onClick={() => setCreationMode('prebuilt')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                creationMode === 'prebuilt' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Pre-built Blueprints
            </button>
          </div>

          {agents.length > 0 && (
            <select
              value={selectedAgentId}
              onChange={(e) => {
                const found = agents.find((a) => a.id === e.target.value);
                if (found) loadAgent(found);
              }}
              className="bg-white border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-2 outline-none focus:border-emerald-500"
            >
              <option value="">-- Select Profile --</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.agentType})</option>
              ))}
            </select>
          )}

          <Button 
            onClick={handleCreateNew} 
            variant="outline" 
            className="text-xs bg-white border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl px-3"
          >
            <Plus className="h-4 w-4 mr-1" /> New Persona
          </Button>
        </div>
      </div>

      {/* Main Studio Frame Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side Studio Controller */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* MODE A: PROMPT-BASE */}
          {creationMode === 'prompt' && (
            <Card className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5">
                <CardTitle className="text-sm font-bold text-slate-800">Prompt Optimizer Low-Code Engine</CardTitle>
                <CardDescription className="text-xs text-slate-400">Describe the assistant role in plain English and let the system optimize details.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Natural Language Description</label>
                  <textarea
                    value={promptDescription}
                    onChange={(e) => setPromptDescription(e.target.value)}
                    rows={4}
                    placeholder="e.g., You are a patient dental clinic receptionist scheduling appointments..."
                    className="w-full rounded-xl border border-slate-200 bg-white text-xs p-4 outline-none focus:border-emerald-500 resize-none stable-scrollbar"
                  />
                </div>
                <Button 
                  onClick={handleOptimizePrompt} 
                  disabled={optimizing} 
                  className="w-full bg-emerald-600 hover:bg-emerald-555 text-white font-bold py-4 rounded-xl text-xs uppercase tracking-wider"
                >
                  {optimizing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
                  Optimize & Generate Agent
                </Button>

                <div className="border-t border-slate-100 pt-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase block">Agent Name</label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white border-slate-200 text-xs rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase block">Description</label>
                      <Input value={description} onChange={(e) => setDescription(e.target.value)} className="bg-white border-slate-200 text-xs rounded-xl" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase block">System Instructions script</label>
                    <textarea
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      rows={6}
                      className="w-full rounded-xl border border-slate-200 bg-white text-xs p-4 outline-none focus:border-emerald-500 font-mono resize-none stable-scrollbar"
                    />
                  </div>

                  <Button onClick={handleSaveAgent} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-555 text-white font-bold py-4 rounded-xl text-xs uppercase tracking-wider">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                    Save Agent Profile
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* MODE B: CONVERSATION FLOW ENGINE */}
          {creationMode === 'canvas' && (
            <Card className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden min-h-[500px] flex flex-col justify-between relative bg-slate-50/10">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-4 z-10 flex flex-row justify-between items-center flex-wrap gap-2">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-800">Visual Flow Graph</CardTitle>
                  <CardDescription className="text-[10px] text-slate-400">Map custom interactive components and publish structure to agentConfig.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <select 
                    onChange={(e) => handleAddCanvasNode(e.target.value)}
                    defaultValue=""
                    className="bg-white border border-slate-200 text-[10px] rounded-lg px-2.5 py-1.5 outline-none font-bold text-slate-700 cursor-pointer"
                  >
                    <option value="" disabled>+ Add Node</option>
                    <option value="conversation">Conversation Block</option>
                    <option value="logic_split">Logic Split</option>
                    <option value="call_transfer">Call Transfer</option>
                    <option value="ending">Call End</option>
                  </select>
                  <Button onClick={handleSaveAgent} disabled={loading} className="text-xs bg-emerald-600 hover:bg-emerald-555 text-white rounded-lg py-1.5 px-3 h-8">
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                    Publish Flow
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="p-6 flex-1 flex flex-col items-center overflow-y-auto space-y-8 relative py-12">
                {/* SVG connectors */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between py-12 z-0">
                  <svg className="w-full h-full text-slate-200" viewBox="0 0 100 350" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <line x1="50" y1="20" x2="50" y2="330" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                  </svg>
                </div>

                {flowNodes.map((n) => {
                  const isSelected = selectedNodeId === n.id;
                  let borderClass = 'border-slate-200 bg-white';
                  if (n.type === 'begin') borderClass = 'border-emerald-250 bg-emerald-50/20 text-emerald-800';
                  else if (n.type === 'ending') borderClass = 'border-rose-250 bg-rose-50/20 text-rose-800';
                  else if (n.type === 'call_transfer') borderClass = 'border-amber-250 bg-amber-50/20 text-amber-800';
                  else if (n.type === 'logic_split') borderClass = 'border-indigo-250 bg-indigo-50/20 text-indigo-800';

                  return (
                    <div
                      key={n.id}
                      onClick={() => setSelectedNodeId(n.id)}
                      className={`w-64 border rounded-2xl p-4 shadow-sm relative z-10 cursor-pointer transition-all ${
                        isSelected ? 'border-emerald-500 scale-[1.02] ring-2 ring-emerald-500/10 font-semibold' : 'hover:border-slate-350'
                      } ${borderClass}`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[8px] font-bold uppercase tracking-widest block opacity-75">{n.type}</span>
                        {n.id !== 'begin' && n.id !== 'welcome-node' && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteNode(n.id);
                            }}
                            className="text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-800">{n.title}</h4>
                      <p className="text-[10px] text-slate-500 truncate mt-1 leading-normal">{n.message}</p>
                      
                      {n.transitions.map((t, idx) => (
                        <div key={idx} className="mt-2 text-[9px] bg-slate-50 border border-slate-200 p-1.5 rounded-lg flex items-center justify-between text-slate-500">
                          <span className="truncate max-w-[120px]">{t.condition}</span>
                          <ChevronRight className="h-3 w-3 text-slate-400" />
                          <span className="font-bold truncate max-w-[60px]">{t.targetId}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* MODE C: PRE-BUILT TURNKEY AGENTS */}
          {creationMode === 'prebuilt' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {BLUEPRINTS.map((bp) => (
                <Card 
                  key={bp.id} 
                  className="border-slate-200 bg-white hover:border-slate-350 hover:shadow-sm cursor-pointer transition-all rounded-3xl overflow-hidden"
                  onClick={() => handleInjectBlueprint(bp)}
                >
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5">
                    <span className="text-[8px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-250/50 px-2.5 py-0.5 rounded-full uppercase tracking-wider block w-fit">
                      {bp.toolName}
                    </span>
                    <CardTitle className="text-sm font-bold text-slate-800 mt-2">{bp.title}</CardTitle>
                    <CardDescription className="text-[11px] text-slate-400">{bp.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 text-[11px] text-slate-500 space-y-2">
                    <div className="flex justify-between">
                      <span>Optimal Voice:</span>
                      <span className="font-semibold text-slate-700">{bp.voiceName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Temperature Boundary:</span>
                      <span className="font-semibold text-slate-700">{bp.temperature.toFixed(1)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

        </div>

        {/* Right Side Settings Tabs & Dialer */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden">
            
            {/* Accordion sub selector */}
            <div className="flex border-b border-slate-200 text-center text-xs">
              <button
                onClick={() => setPhoneNumber('+919876543210')}
                className="flex-1 py-3.5 font-bold text-emerald-700 border-b-2 border-emerald-600 bg-white"
              >
                Settings Details
              </button>
            </div>

            <CardContent className="p-5 space-y-4">
              
              {/* Canvas active node context editor */}
              {creationMode === 'canvas' && activeNode && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Selected Block Config</span>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase block">Block Title</label>
                    <Input value={activeNode.title} onChange={(e) => handleUpdateNodeField('title', e.target.value)} className="bg-white border-slate-200 text-xs rounded-xl h-8" />
                  </div>
                  {activeNode.type === 'call_transfer' && (
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase block">SIP Target Number</label>
                      <Input value={activeNode.phoneNumber || ''} onChange={(e) => handleUpdateNodeField('phoneNumber', e.target.value)} className="bg-white border-slate-200 text-xs rounded-xl h-8 font-mono" />
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase block">Dialogue Speech Message</label>
                    <textarea
                      value={activeNode.message}
                      onChange={(e) => handleUpdateNodeField('message', e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 bg-white text-xs p-2 outline-none focus:border-emerald-500 font-mono resize-none stable-scrollbar"
                    />
                  </div>
                </div>
              )}

              {/* Core Audio and parameter options */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Target Voice Persona</label>
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

              <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">LLM Temperature</span>
                  <span className="text-emerald-700 font-mono font-bold">{temperature.toFixed(1)}</span>
                </div>
                <input
                  type="range" min="0.0" max="2.0" step="0.1"
                  value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-emerald-600"
                />
              </div>

              {/* Integrated Dialer Playground */}
              <div className="border-t border-slate-100 pt-4 space-y-3.5">
                <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Telephony Simulator</label>
                  <div className="flex flex-col gap-2">
                    <Input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="bg-white border-slate-200 rounded-xl text-xs" />
                    {['initiating', 'ringing', 'connected', 'in_progress'].includes(callStatus) ? (
                      <Button onClick={handleHangUp} disabled={dialing} variant="destructive" className="bg-rose-600 hover:bg-rose-500 rounded-xl w-full text-xs font-bold py-3.5 h-10 flex items-center justify-center gap-1.5">
                        {dialing && <Loader2 className="h-4 w-4 animate-spin" />}
                        Hang Up Connection
                      </Button>
                    ) : (
                      <Button onClick={handleInitiateCall} disabled={dialing} className="bg-emerald-600 hover:bg-emerald-555 text-white rounded-xl w-full text-xs font-bold py-3.5 h-10 flex items-center justify-center gap-1.5">
                        {dialing && <Loader2 className="h-4 w-4 animate-spin" />}
                        Initiate Live Screen Call
                      </Button>
                    )}
                  </div>
                </div>

                <div className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${getStatusColor(callStatus)}`}>
                  <span className="font-semibold">{getStatusLabel(callStatus)}</span>
                  {['connected', 'in_progress'].includes(callStatus) && <span className="font-mono text-slate-800">{formatSecToTime(duration)}</span>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Dialogue transcription logs</label>
                  <div className="h-56 rounded-2xl border border-slate-200 bg-white p-4 overflow-y-auto space-y-3 stable-scrollbar">
                    {transcripts.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-400 text-xs">No active sessions. Start call to monitor speech.</div>
                    ) : (
                      transcripts.map((t) => {
                        const isAgent = t.speaker === 'agent';
                        return (
                          <div key={t.id} className={`flex max-w-[85%] ${isAgent ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}>
                            <div className={`rounded-2xl px-3 py-2 border text-xs leading-relaxed ${
                              isAgent 
                                ? 'bg-[#1E293B] text-[#F8FAFC] border-[#334155]' // Clarity AI responses inside a charcoal slate visual box
                                : 'bg-[#E8E3D9]/60 text-slate-800 border-slate-200' // Candidate inputs styled with a distinct text frame bubble
                            }`}>
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

            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
