'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import api from '@/lib/api-client';

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

  const getRuntimeUrls = () => {
    const envUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
    const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    
    const apiBase = envUrl || (isLocal ? 'http://localhost:3001' : 'https://ai-voice-agent-backend-mv32.onrender.com');
    const wsBase = process.env.NEXT_PUBLIC_WS_URL || apiBase.replace(/^http/, 'ws');
    
    return { apiBase, wsBase };
  };

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
      const { apiBase } = getRuntimeUrls();
      const res = await api.get(`${apiBase}/api/v2/agents`);
      if (res.data && res.data.success) {
        setAgents(res.data.data);
        if (res.data.data.length > 0 && !selectedAgentId) {
          loadAgent(res.data.data[0]);
        }
      }
    } catch (err: any) {
      console.error('Core Client Network Trace Failure:', err);
      showToast('error', `Connectivity Fault: ${err.message || 'Backend unreachable'}`);
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
      const { apiBase } = getRuntimeUrls();
      const res = await api.post(`${apiBase}/api/v2/agents/optimize`, {
        description: promptDescription
      });
      if (res.data && res.data.success && res.data.data) {
        setInstructions(res.data.data.prompt);
        setSelectedVoice(res.data.data.voiceName);
        setTemperature(res.data.data.temperature);
        showToast('success', 'Enriched instruction script successfully loaded.');
      }
    } catch (err: any) {
      console.error('Core Client Network Trace Failure:', err);
      showToast('error', `Error optimizing prompt instructions: ${err.message || 'Backend unreachable'}`);
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
      const { apiBase } = getRuntimeUrls();
      const url = selectedAgentId 
        ? `${apiBase}/api/v2/agents/${selectedAgentId}`
        : `${apiBase}/api/v2/agents`;

      const res = selectedAgentId 
        ? await api.put(url, payload)
        : await api.post(url, payload);

      if (res.data && res.data.success) {
        showToast('success', 'Agent Configuration schema updated successfully.');
        await fetchAgents();
        if (!selectedAgentId && res.data.data) {
          loadAgent(res.data.data);
        }
      }
    } catch (err: any) {
      console.error('Core Client Network Trace Failure:', err);
      showToast('error', `Error writing configuration changes: ${err.message || 'Backend unreachable'}`);
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

      const { apiBase } = getRuntimeUrls();
      const res = await api.post(`${apiBase}/api/calls/outbound`, {
        phoneNumber,
        agentId: selectedAgentId,
        userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
      });

      if (res.data && res.data.success && res.data.data) {
        setCallId(res.data.data.callId);
        setCallStatus(res.data.data.status);
        startCallMonitoring(res.data.data.callId);
      }
    } catch (err: any) {
      console.error('Core Client Network Trace Failure:', err);
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
      console.error('Core Client Network Trace Failure:', err);
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
      console.error('[WebSocket Error Metrics] Live monitor thread encountered an issue:', error);
    };

    ws.onclose = (event) => {
      console.log('[WebSocket Close Metrics] Live monitor socket closed. Code:', event.code, 'Reason:', event.reason, 'WasClean:', event.wasClean);
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
        console.error('[Call Polling Failure] Error fetching call status:', e);
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
    <div>
      {/* Notifications toast */}
      {toast && (
        <div style={{ border: '1px solid black', padding: '10px', margin: '10px 0', background: '#ffebeb' }}>
          {toast.text}
        </div>
      )}

      {/* Top Header Card */}
      <header style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #ccc' }}>
        <div>
          <h1>Tri-Mode Agent Studio</h1>
          <p>Rebuild, design, and configure voice AI configurations across three optimized creation engines.</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Tri-Mode Selector Tab */}
          <div>
            <button
              onClick={() => setCreationMode('prompt')}
              disabled={creationMode === 'prompt'}
            >
              Prompt-Base
            </button>
            <button
              onClick={() => setCreationMode('canvas')}
              disabled={creationMode === 'canvas'}
            >
              Canvas Flow
            </button>
            <button
              onClick={() => setCreationMode('prebuilt')}
              disabled={creationMode === 'prebuilt'}
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
            >
              <option value="">-- Select Profile --</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.agentType})</option>
              ))}
            </select>
          )}

          <button onClick={handleCreateNew}>
            New Persona
          </button>
        </div>
      </header>

      {/* Main Studio Frame Layout */}
      <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
        
        {/* Left Side Studio Controller */}
        <div style={{ flex: 2 }}>
          
          {/* MODE A: PROMPT-BASE */}
          {creationMode === 'prompt' && (
            <div style={{ border: '1px solid #ccc', padding: '15px' }}>
              <h2>Prompt Optimizer Low-Code Engine</h2>
              <p>Describe the assistant role in plain English and let the system optimize details.</p>
              
              <div style={{ margin: '10px 0' }}>
                <label style={{ display: 'block', fontWeight: 'bold' }}>Natural Language Description</label>
                <textarea
                  value={promptDescription}
                  onChange={(e) => setPromptDescription(e.target.value)}
                  rows={4}
                  placeholder="e.g., You are a patient dental clinic receptionist scheduling appointments..."
                  style={{ width: '100%' }}
                />
              </div>
              <button onClick={handleOptimizePrompt} disabled={optimizing}>
                {optimizing ? 'Optimizing...' : 'Optimize & Generate Agent'}
              </button>

              <div style={{ marginTop: '20px', borderTop: '1px solid #ccc', paddingTop: '15px' }}>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontWeight: 'bold' }}>Agent Name</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontWeight: 'bold' }}>Description</label>
                    <input value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: '100%' }} />
                  </div>
                </div>

                <div style={{ margin: '10px 0' }}>
                  <label style={{ display: 'block', fontWeight: 'bold' }}>System Instructions script</label>
                  <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    rows={6}
                    style={{ width: '100%' }}
                  />
                </div>

                <button onClick={handleSaveAgent} disabled={loading}>
                  {loading ? 'Saving...' : 'Save Agent Profile'}
                </button>
              </div>
            </div>
          )}

          {/* MODE B: CONVERSATION FLOW ENGINE */}
          {creationMode === 'canvas' && (
            <div style={{ border: '1px solid #ccc', padding: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3>Visual Flow Graph</h3>
                  <p>Map custom interactive components and publish structure to agentConfig.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select 
                    onChange={(e) => handleAddCanvasNode(e.target.value)}
                    defaultValue=""
                  >
                    <option value="" disabled>+ Add Node</option>
                    <option value="conversation">Conversation Block</option>
                    <option value="logic_split">Logic Split</option>
                    <option value="call_transfer">Call Transfer</option>
                    <option value="ending">Call End</option>
                  </select>
                  <button onClick={handleSaveAgent} disabled={loading}>
                    {loading ? 'Publishing...' : 'Publish Flow'}
                  </button>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
                {flowNodes.map((n) => {
                  const isSelected = selectedNodeId === n.id;
                  return (
                    <div
                      key={n.id}
                      onClick={() => setSelectedNodeId(n.id)}
                      style={{
                        border: isSelected ? '2px solid green' : '1px solid #ccc',
                        padding: '10px',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase' }}>{n.type}</span>
                        {n.id !== 'begin' && n.id !== 'welcome-node' && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteNode(n.id);
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                      <h4>{n.title}</h4>
                      <p>{n.message}</p>
                      
                      {n.transitions.map((t, idx) => (
                        <div key={idx} style={{ fontSize: '11px', background: '#f5f5f5', padding: '4px', margin: '4px 0' }}>
                          <span>If intent matches: "{t.condition}" -{'>'} Transition to [{t.targetId}]</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MODE C: PRE-BUILT TURNKEY AGENTS */}
          {creationMode === 'prebuilt' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {BLUEPRINTS.map((bp) => (
                <div 
                  key={bp.id} 
                  style={{ border: '1px solid #ccc', padding: '15px', cursor: 'pointer' }}
                  onClick={() => handleInjectBlueprint(bp)}
                >
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#666' }}>{bp.toolName}</span>
                  <h3>{bp.title}</h3>
                  <p>{bp.description}</p>
                  <div style={{ fontSize: '11px', marginTop: '5px' }}>
                    <span>Optimal Voice: <strong>{bp.voiceName}</strong></span>
                    <br />
                    <span>Temperature Boundary: <strong>{bp.temperature.toFixed(1)}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Right Side Settings Tabs & Dialer */}
        <div style={{ flex: 1, border: '1px solid #ccc', padding: '15px' }}>
          <div>
            <h3>Settings Details</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}>
            
            {/* Canvas active node context editor */}
            {creationMode === 'canvas' && activeNode && (
              <div style={{ border: '1px solid #ccc', padding: '10px', background: '#f9f9f9' }}>
                <strong>Selected Block Config</strong>
                <div style={{ margin: '5px 0' }}>
                  <label style={{ display: 'block', fontSize: '11px' }}>Block Title</label>
                  <input value={activeNode.title} onChange={(e) => handleUpdateNodeField('title', e.target.value)} style={{ width: '100%' }} />
                </div>
                {activeNode.type === 'call_transfer' && (
                  <div style={{ margin: '5px 0' }}>
                    <label style={{ display: 'block', fontSize: '11px' }}>SIP Target Number</label>
                    <input value={activeNode.phoneNumber || ''} onChange={(e) => handleUpdateNodeField('phoneNumber', e.target.value)} style={{ width: '100%' }} />
                  </div>
                )}
                <div style={{ margin: '5px 0' }}>
                  <label style={{ display: 'block', fontSize: '11px' }}>Dialogue Speech Message</label>
                  <textarea
                    value={activeNode.message}
                    onChange={(e) => handleUpdateNodeField('message', e.target.value)}
                    rows={3}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            )}

            {/* Core Audio and parameter options */}
            <div>
              <label style={{ display: 'block', fontWeight: 'bold' }}>Target Voice Persona</label>
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                style={{ width: '100%' }}
              >
                {VOICE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>LLM Temperature</span>
                <strong>{temperature.toFixed(1)}</strong>
              </div>
              <input
                type="range" min="0.0" max="2.0" step="0.1"
                value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            {/* Integrated Dialer Playground */}
            <div style={{ borderTop: '1px solid #ccc', paddingTop: '15px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold' }}>Telephony Simulator</label>
                <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} style={{ width: '100%' }} />
                <div style={{ marginTop: '10px' }}>
                  {['initiating', 'ringing', 'connected', 'in_progress'].includes(callStatus) ? (
                    <button onClick={handleHangUp} disabled={dialing} style={{ width: '100%', padding: '10px', background: 'red', color: 'white' }}>
                      Hang Up Connection
                    </button>
                  ) : (
                    <button onClick={handleInitiateCall} disabled={dialing} style={{ width: '100%', padding: '10px', background: 'green', color: 'white' }}>
                      Initiate Live Screen Call
                    </button>
                  )}
                </div>
              </div>

              <div style={{ border: '1px solid #ccc', padding: '8px', marginTop: '10px' }}>
                Status: <strong>{getStatusLabel(callStatus)}</strong>
                {['connected', 'in_progress'].includes(callStatus) && <span style={{ marginLeft: '10px' }}>{formatSecToTime(duration)}</span>}
              </div>

              <div style={{ marginTop: '15px' }}>
                <label style={{ display: 'block', fontWeight: 'bold' }}>Dialogue transcription logs</label>
                <div style={{ height: '200px', border: '1px solid #ccc', overflowY: 'auto', padding: '8px', background: 'white' }}>
                  {transcripts.length === 0 ? (
                    <div style={{ color: '#999' }}>No active sessions. Start call to monitor speech.</div>
                  ) : (
                    transcripts.map((t) => {
                      const isAgent = t.speaker === 'agent';
                      return (
                        <div key={t.id} style={{ display: 'flex', justifyContent: isAgent ? 'flex-start' : 'flex-end', margin: '5px 0' }}>
                          <div style={{
                            padding: '6px 10px',
                            borderRadius: '8px',
                            background: isAgent ? '#f0f0f0' : '#e0e0ff',
                            maxWidth: '80%'
                          }}>
                            <strong>{t.speaker}:</strong> {t.text}
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

      </div>
    </div>
  );
}
