import React, { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  Connection,
  Edge,
  Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  MessageSquare,
  HelpCircle,
  GitBranch,
  PhoneForwarded,
  PhoneOff,
  Calendar,
  Wrench,
  Plus,
  Trash2,
  Sparkles,
  Code,
  AlertTriangle,
  FileText,
  Layers,
  ArrowLeft,
  Play,
  Volume2,
  Bot,
  Hash,
  UserCheck,
  MessageCircle,
  Binary,
  Globe,
  StickyNote,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Sliders,
  Mic,
  X,
  Check,
} from 'lucide-react';
import { FlowGraph, FlowNode, FlowNodeType, compileFlowToSystemPrompt } from './flowCompiler';
import {
  GEMINI_VOICES,
  LANGUAGE_OPTIONS,
  HANDBOOK_PRESETS,
  compilePromptWithHandbook,
} from './SinglePromptStudio';

interface VisualFlowCanvasProps {
  initialGraph?: FlowGraph | null;
  legacySystemPrompt?: string;
  agentName?: string;
  onSave: (compiledPrompt: string, flowGraph: FlowGraph, extraConfig?: Record<string, any>) => void;
  onBack?: () => void;
}


// ── Custom Node Components for @xyflow/react ────────────────────────────

const RetellNodeCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  colorClass: string;
  selected?: boolean;
  children?: React.ReactNode;
}> = ({ title, icon, colorClass, selected, children }) => (
  <div
    className={`p-3 min-w-[220px] max-w-[260px] rounded-xl bg-white dark:bg-slate-900 border transition-all shadow-md ${
      selected ? 'ring-2 ring-indigo-500 border-indigo-500 shadow-indigo-100' : 'border-slate-200 dark:border-slate-800'
    }`}
    style={{ fontFamily: "'Inter', sans-serif" }}
  >
    <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 !bg-indigo-500 border-2 border-white" />
    <div className="flex items-center gap-2 mb-1.5 pb-1.5 border-b border-slate-100 dark:border-slate-800">
      <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${colorClass}`}>
        {icon}
      </div>
      <p className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">{title}</p>
    </div>
    <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1">{children}</div>
    <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 !bg-indigo-500 border-2 border-white" />
  </div>
);

const nodeTypes = {
  start: ({ data, selected }: any) => (
    <RetellNodeCard title={data.label || 'Start Greeting'} icon={<MessageSquare className="w-3.5 h-3.5 text-blue-500" />} colorClass="bg-blue-50" selected={selected}>
      <p className="line-clamp-2 italic">"{data.text || data.message || 'Call start greeting...'}"</p>
    </RetellNodeCard>
  ),
  conversation: ({ data, selected }: any) => (
    <RetellNodeCard title={data.label || 'Conversation'} icon={<MessageSquare className="w-3.5 h-3.5 text-blue-500" />} colorClass="bg-blue-50" selected={selected}>
      <p className="line-clamp-2 italic">"{data.text || data.message || 'Welcome message speech payload...'}"</p>
    </RetellNodeCard>
  ),
  sayMessage: ({ data, selected }: any) => (
    <RetellNodeCard title={data.label || 'Say Message'} icon={<MessageSquare className="w-3.5 h-3.5 text-blue-500" />} colorClass="bg-blue-50" selected={selected}>
      <p className="line-clamp-2 italic">"{data.text || 'No message set'}"</p>
    </RetellNodeCard>
  ),
  askQuestion: ({ data, selected }: any) => (
    <RetellNodeCard title={data.label || 'Ask Question'} icon={<HelpCircle className="w-3.5 h-3.5 text-amber-500" />} colorClass="bg-amber-50" selected={selected}>
      <p className="line-clamp-2 italic">"{data.question || data.text || 'No question set'}"</p>
    </RetellNodeCard>
  ),
  subagent: ({ data, selected }: any) => (
    <RetellNodeCard title={data.label || 'Subagent'} icon={<Bot className="w-3.5 h-3.5 text-indigo-500" />} colorClass="bg-indigo-50" selected={selected}>
      <p className="font-medium text-[10px]">Target: {data.subagentName || 'Support Bot'}</p>
    </RetellNodeCard>
  ),
  function: ({ data, selected }: any) => (
    <RetellNodeCard title={data.label || 'Function Call'} icon={<Wrench className="w-3.5 h-3.5 text-purple-500" />} colorClass="bg-purple-50" selected={selected}>
      <p className="font-mono text-[10px] text-purple-600">{data.toolName || 'api_webhook'}</p>
    </RetellNodeCard>
  ),
  callTool: ({ data, selected }: any) => (
    <RetellNodeCard title={data.label || 'Call Tool'} icon={<Wrench className="w-3.5 h-3.5 text-purple-500" />} colorClass="bg-purple-50" selected={selected}>
      <p className="font-mono text-[10px] text-purple-600">{data.toolName || 'api_webhook'}</p>
    </RetellNodeCard>
  ),
  transferCall: ({ data, selected }: any) => (
    <RetellNodeCard title={data.label || 'Call Transfer'} icon={<PhoneForwarded className="w-3.5 h-3.5 text-green-500" />} colorClass="bg-green-50" selected={selected}>
      <p className="font-mono text-[10px] text-green-600">{data.targetNumber || '+18005550199'}</p>
    </RetellNodeCard>
  ),
  pressDigit: ({ data, selected }: any) => (
    <RetellNodeCard title={data.label || 'Press Digit'} icon={<Hash className="w-3.5 h-3.5 text-cyan-500" />} colorClass="bg-cyan-50" selected={selected}>
      <p className="font-mono text-[10px]">Keypad Digit: {data.digits || '1'}</p>
    </RetellNodeCard>
  ),
  logicSplit: ({ data, selected }: any) => (
    <RetellNodeCard title={data.label || 'Logic Split'} icon={<GitBranch className="w-3.5 h-3.5 text-orange-500" />} colorClass="bg-orange-50" selected={selected}>
      <p className="text-[10px]">Variable: {data.variable || 'user_intent'}</p>
    </RetellNodeCard>
  ),
  conditionBranch: ({ data, selected }: any) => (
    <RetellNodeCard title={data.label || 'Condition Branch'} icon={<GitBranch className="w-3.5 h-3.5 text-orange-500" />} colorClass="bg-orange-50" selected={selected}>
      <p className="text-[10px]">Variable: {data.variable || 'user_intent'}</p>
    </RetellNodeCard>
  ),
  agentTransfer: ({ data, selected }: any) => (
    <RetellNodeCard title={data.label || 'Agent Transfer'} icon={<UserCheck className="w-3.5 h-3.5 text-emerald-500" />} colorClass="bg-emerald-50" selected={selected}>
      <p className="text-[10px]">Agent: {data.subagentName || 'Escalation'}</p>
    </RetellNodeCard>
  ),
  inCallSms: ({ data, selected }: any) => (
    <RetellNodeCard title={data.label || 'In-Call SMS'} icon={<MessageCircle className="w-3.5 h-3.5 text-teal-500" />} colorClass="bg-teal-50" selected={selected}>
      <p className="line-clamp-1 italic">"{data.smsMessage || 'Confirmation SMS'}"</p>
    </RetellNodeCard>
  ),
  extractVariable: ({ data, selected }: any) => (
    <RetellNodeCard title={data.label || 'Extract Variable'} icon={<Binary className="w-3.5 h-3.5 text-pink-500" />} colorClass="bg-pink-50" selected={selected}>
      <p className="font-mono text-[10px]">Var: {data.variable || 'slot_time'}</p>
    </RetellNodeCard>
  ),
  code: ({ data, selected }: any) => (
    <RetellNodeCard title={data.label || 'Code'} icon={<Code className="w-3.5 h-3.5 text-slate-600" />} colorClass="bg-slate-100" selected={selected}>
      <p className="font-mono text-[10px]">Inline Code Exec</p>
    </RetellNodeCard>
  ),
  mcp: ({ data, selected }: any) => (
    <RetellNodeCard title={data.label || 'MCP'} icon={<Globe className="w-3.5 h-3.5 text-sky-500" />} colorClass="bg-sky-50" selected={selected}>
      <p className="font-mono text-[10px]">{data.mcpServer || 'mcp_server_01'}</p>
    </RetellNodeCard>
  ),
  ending: ({ data, selected }: any) => (
    <RetellNodeCard title={data.label || 'Ending'} icon={<PhoneOff className="w-3.5 h-3.5 text-rose-500" />} colorClass="bg-rose-50" selected={selected}>
      <p className="line-clamp-1 italic">"{data.text || 'Goodbye!'}"</p>
    </RetellNodeCard>
  ),
  endCall: ({ data, selected }: any) => (
    <RetellNodeCard title={data.label || 'End Call'} icon={<PhoneOff className="w-3.5 h-3.5 text-rose-500" />} colorClass="bg-rose-50" selected={selected}>
      <p className="line-clamp-1 italic">"{data.text || 'Goodbye!'}"</p>
    </RetellNodeCard>
  ),
  note: ({ data, selected }: any) => (
    <RetellNodeCard title={data.label || 'Note'} icon={<StickyNote className="w-3.5 h-3.5 text-amber-500" />} colorClass="bg-amber-100" selected={selected}>
      <p className="text-[10px] italic">{data.noteText || 'Design annotation'}</p>
    </RetellNodeCard>
  ),
  checkCalendar: ({ data, selected }: any) => (
    <RetellNodeCard title={data.label || 'Check Calendar'} icon={<Calendar className="w-3.5 h-3.5 text-teal-500" />} colorClass="bg-teal-50" selected={selected}>
      <p className="text-[10px]">Calendar Slot Check</p>
    </RetellNodeCard>
  ),
};

export default function VisualFlowCanvas({
  initialGraph,
  legacySystemPrompt,
  agentName: initialAgentName = 'Conversation Flow Agent',
  onSave,
  onBack,
}: VisualFlowCanvasProps) {
  const [agentName, setAgentName] = useState(initialAgentName);
  const [activePaletteTab, setActivePaletteTab] = useState<'node' | 'subflows'>('node');
  const [activeInspectorTab, setActiveInspectorTab] = useState<'global' | 'node'>('global');
  
  // Retell Global Settings state
  const [language, setLanguage] = useState('auto');
  const [voice, setVoice] = useState('Puck');
  const [model] = useState('gemini-2.5-flash');
  const [globalPrompt, setGlobalPrompt] = useState(legacySystemPrompt || 'Enter your global prompt here. Type {{ to add dynamic variables.');
  const [flexibilityMode, setFlexibilityMode] = useState<'flex' | 'rigid'>('rigid');
  const [handbookPresets, setHandbookPresets] = useState<string[]>(['ai_disclosure']);
  const [showHandbookPopover, setShowHandbookPopover] = useState(false);

  const toggleHandbookPreset = (id: string) => {
    setHandbookPresets((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  // Collapsible accordion states
  const [kbAccordionOpen, setKbAccordionOpen] = useState(false);
  const [speechAccordionOpen, setSpeechAccordionOpen] = useState(false);
  const [transcriptionAccordionOpen, setTranscriptionAccordionOpen] = useState(false);

  // Default Node Seeding
  const defaultNodes: Node[] = [
    {
      id: 'node-1',
      type: 'conversation',
      position: { x: 300, y: 120 },
      data: { label: 'Welcome Node', text: 'Hello! Thank you for calling Claritiy Voice. How can I help you today?' },
    },
    {
      id: 'node-2',
      type: 'askQuestion',
      position: { x: 300, y: 260 },
      data: { label: 'Inquire Request', question: 'Are you looking to book an appointment or do you have a support question?' },
    },
    {
      id: 'node-3',
      type: 'logicSplit',
      position: { x: 300, y: 400 },
      data: { label: 'Logic Split', variable: 'user_intent' },
    },
    {
      id: 'node-4',
      type: 'ending',
      position: { x: 300, y: 550 },
      data: { label: 'Ending', text: 'Thank you for calling Claritiy Voice. Have a wonderful day!' },
    },
  ];

  const defaultEdges: Edge[] = [
    { id: 'e1-2', source: 'node-1', target: 'node-2', animated: true },
    { id: 'e2-3', source: 'node-2', target: 'node-3', animated: true },
    { id: 'e3-4', source: 'node-3', target: 'node-4', animated: true },
  ];

  const initialNodesState = useMemo(() => {
    if (initialGraph && initialGraph.nodes && initialGraph.nodes.length > 0) {
      return initialGraph.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position || { x: 300, y: 150 },
        data: n.data || { label: 'Node' },
      }));
    }
    return defaultNodes;
  }, [initialGraph]);

  const initialEdgesState = useMemo(() => {
    if (initialGraph && initialGraph.edges) {
      return initialGraph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        animated: true,
      }));
    }
    return defaultEdges;
  }, [initialGraph]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodesState);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdgesState);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  const currentFlowGraph: FlowGraph = useMemo(
    () => ({
      schemaVersion: 1,
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type as any,
        position: n.position,
        data: n.data as any,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
      })),
    }),
    [nodes, edges]
  );

  const compiledPrompt = useMemo(() => {
    const base = compileFlowToSystemPrompt(currentFlowGraph, agentName);
    const fullBase = `${globalPrompt}\n\n${base}`;
    return compilePromptWithHandbook(fullBase, handbookPresets);
  }, [currentFlowGraph, agentName, globalPrompt, handbookPresets]);

  const handleAddNode = (type: FlowNodeType, label: string) => {
    const newId = `node-${Date.now()}`;
    const newNode: Node = {
      id: newId,
      type,
      position: { x: 300 + Math.random() * 60, y: 180 + nodes.length * 70 },
      data: {
        label,
        text: type === 'conversation' || type === 'sayMessage' ? 'Speech message payload' : undefined,
        question: type === 'askQuestion' ? 'How can I assist you?' : undefined,
        targetNumber: type === 'transferCall' ? '+18005550199' : undefined,
        toolName: type === 'function' || type === 'callTool' ? 'webhook_action' : undefined,
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(newId);
    setActiveInspectorTab('node');
  };

  const updateSelectedNodeData = (fields: Record<string, any>) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ...fields,
            },
          };
        }
        return node;
      })
    );
  };

  const handleDeleteSelectedNode = () => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
    setActiveInspectorTab('global');
  };

  const handlePublish = () => {
    onSave(compiledPrompt, currentFlowGraph, {
      language,
      languageMode: language,
      systemVoice: voice,
      voiceName: voice,
      model,
      flexibilityMode,
      handbookPresets,
    });
  };

  // 15 Node Building Blocks for Retell Left Palette
  const nodePaletteList = [
    { type: 'conversation' as FlowNodeType, label: 'Conversation', desc: 'Agent speech or response', icon: <MessageSquare className="w-4 h-4 text-blue-500" /> },
    { type: 'askQuestion' as FlowNodeType, label: 'Collect Input', desc: 'Ask caller & store variable', icon: <HelpCircle className="w-4 h-4 text-violet-500" /> },
    { type: 'checkCalendar' as FlowNodeType, label: 'Check Calendar Availability', desc: 'Query open calendar slots', icon: <Calendar className="w-4 h-4 text-emerald-500" /> },
    { type: 'subagent' as FlowNodeType, label: 'Subagent', desc: 'Delegate flow to subagent', icon: <Bot className="w-4 h-4 text-indigo-500" /> },
    { type: 'function' as FlowNodeType, label: 'Function', desc: 'Call external tool/webhook', icon: <Wrench className="w-4 h-4 text-purple-500" /> },
    { type: 'transferCall' as FlowNodeType, label: 'Call Transfer', desc: 'Transfer call to number', icon: <PhoneForwarded className="w-4 h-4 text-green-500" /> },
    { type: 'pressDigit' as FlowNodeType, label: 'Press Digit', desc: 'IVR DTMF key press', icon: <Hash className="w-4 h-4 text-cyan-500" /> },
    { type: 'logicSplit' as FlowNodeType, label: 'Logic Split', desc: 'Conditional intent branch', icon: <GitBranch className="w-4 h-4 text-orange-500" /> },
    { type: 'agentTransfer' as FlowNodeType, label: 'Agent Transfer', desc: 'Hand over to specialist', icon: <UserCheck className="w-4 h-4 text-emerald-500" /> },
    { type: 'inCallSms' as FlowNodeType, label: 'In-Call SMS', desc: 'Send text during call', icon: <MessageCircle className="w-4 h-4 text-teal-500" /> },
    { type: 'extractVariable' as FlowNodeType, label: 'Extract Variable', desc: 'Capture response slots', icon: <Binary className="w-4 h-4 text-pink-500" /> },
    { type: 'code' as FlowNodeType, label: 'Code', desc: 'Execute inline code logic', icon: <Code className="w-4 h-4 text-slate-600" /> },
    { type: 'mcp' as FlowNodeType, label: 'MCP', desc: 'Model Context Protocol', icon: <Globe className="w-4 h-4 text-sky-500" /> },
    { type: 'ending' as FlowNodeType, label: 'Ending', desc: 'Terminate call session', icon: <PhoneOff className="w-4 h-4 text-rose-500" /> },
    { type: 'note' as FlowNodeType, label: 'Note', desc: 'Add visual canvas note', icon: <StickyNote className="w-4 h-4 text-amber-500" /> },
  ];


  return (
    <div className="fixed inset-0 z-[9999] bg-white dark:bg-slate-950 flex flex-col overflow-hidden font-sans text-slate-900 dark:text-slate-100">
      {/* ── 1. RETELL TOP NAVIGATION HEADER BAR ──────────────────────────── */}
      <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 flex items-center justify-between gap-4 z-20 flex-shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              title="Back to agents"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <input
            type="text"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            className="font-bold text-sm bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none px-1 py-0.5"
          />

          <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
            Environment
          </span>
        </div>

        {/* Right Top Header Actions */}
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all">
            Feedback
          </button>

          <button className="px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg flex items-center gap-1.5 hover:bg-indigo-100 transition-all">
            <Play className="w-3.5 h-3.5" /> Test
          </button>

          <button
            onClick={handlePublish}
            className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
          >
            Publish
          </button>
        </div>
      </header>

      {/* ── 2. MAIN RETELL CANVAS BODY STUDIO ──────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ── LEFT PALETTE TOOLBAR ──────────────────────────── */}
        <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col z-10 flex-shrink-0">
          {/* Tab Switcher: Node vs Subflows */}
          <div className="p-2 border-b border-slate-200 dark:border-slate-800 flex gap-1">
            <button
              onClick={() => setActivePaletteTab('node')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activePaletteTab === 'node'
                  ? 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Node
            </button>
            <button
              onClick={() => setActivePaletteTab('subflows')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activePaletteTab === 'subflows'
                  ? 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Subflows
            </button>
          </div>

          {/* Palette List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {activePaletteTab === 'node' ? (
              nodePaletteList.map((item) => (
                <button
                  key={item.type}
                  onClick={() => handleAddNode(item.type, item.label)}
                  className="w-full text-left p-2 rounded-lg border border-slate-100 dark:border-slate-800/80 hover:border-indigo-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all flex items-center gap-2.5 group"
                >
                  <div className="w-7 h-7 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                    {item.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-xs text-slate-800 dark:text-slate-200">{item.label}</p>
                    <p className="text-[10px] text-slate-400 truncate">{item.desc}</p>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-slate-400">
                No custom subflows created. Subflows allow reusable multi-node modules.
              </div>
            )}
          </div>


        </aside>

        {/* ── CENTER VIEWPORT CANVAS ──────────────────────────── */}
        <main className="flex-1 relative flex bg-slate-100/40 dark:bg-slate-950">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => {
              setSelectedNodeId(node.id);
              setActiveInspectorTab('node');
            }}
            fitView
            className="bg-transparent"
          >
            <Controls position="bottom-center" />
            <MiniMap position="bottom-right" className="!bg-white !dark:bg-slate-900 !border-slate-200" />
            <Background color="#cbd5e1" gap={20} size={1} />
          </ReactFlow>
        </main>

        {/* ── RIGHT INSPECTOR PANEL (GLOBAL / NODE SETTINGS) ──────────────────────────── */}
        <aside className="w-80 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col z-10 flex-shrink-0">
          {/* Tab Selector: Global Settings vs Node Settings */}
          <div className="p-2 border-b border-slate-200 dark:border-slate-800 flex gap-1">
            <button
              onClick={() => setActiveInspectorTab('global')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeInspectorTab === 'global'
                  ? 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Global Settings
            </button>
            <button
              onClick={() => setActiveInspectorTab('node')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeInspectorTab === 'node'
                  ? 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Node Settings
            </button>
          </div>

          {/* Inspector Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {activeInspectorTab === 'global' ? (
              /* Global Settings Inspector */
              <div className="space-y-4">
                {/* Language Selector */}
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Voice Selector */}
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">Voice</label>
                  <select
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {GEMINI_VOICES.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.desc}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Agent Handbook */}
                <div className="relative">
                  <div
                    onClick={() => setShowHandbookPopover(!showHandbookPopover)}
                    className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-indigo-500" />
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Agent Handbook</span>
                    </div>
                    <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-full text-[10px] font-bold">
                      {handbookPresets.length} Active
                    </span>
                  </div>

                  {showHandbookPopover && (
                    <div className="mt-2 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl space-y-2">
                      <div className="flex justify-between items-center pb-1 border-b border-slate-100 dark:border-slate-800">
                        <span className="font-bold text-xs">Handbook Presets</span>
                        <button onClick={() => setShowHandbookPopover(false)} className="p-0.5 text-slate-400 hover:text-slate-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {HANDBOOK_PRESETS.map((preset) => {
                          const active = handbookPresets.includes(preset.id);
                          return (
                            <div
                              key={preset.id}
                              onClick={() => toggleHandbookPreset(preset.id)}
                              className={`p-2 rounded-md border text-[11px] cursor-pointer transition-all ${
                                active
                                  ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800'
                                  : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              <div className="flex items-center justify-between font-medium">
                                <span>{preset.label}</span>
                                <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${active ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'}`}>
                                  {active && <Check className="w-2.5 h-2.5" />}
                                </div>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{preset.instruction}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Global Prompt */}
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">Global Prompt</label>
                  <textarea
                    rows={5}
                    value={globalPrompt}
                    onChange={(e) => setGlobalPrompt(e.target.value)}
                    placeholder="Enter your global prompt here. Type {{ to add dynamic variables."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono resize-none"
                  />
                </div>

                {/* Transition Flexibility */}
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-2">Transition Flexibility</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFlexibilityMode('flex')}
                      className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition-all ${
                        flexibilityMode === 'flex'
                          ? 'border-emerald-500 bg-emerald-50/30 text-emerald-700 font-bold'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600'
                      }`}
                    >
                      <span className="font-bold">Flex Mode</span>
                      <span className="text-[10px] opacity-75">Adaptive responses</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFlexibilityMode('rigid')}
                      className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition-all ${
                        flexibilityMode === 'rigid'
                          ? 'border-indigo-500 bg-indigo-50/30 text-indigo-700 font-bold'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600'
                      }`}
                    >
                      <span className="font-bold">Rigid Mode</span>
                      <span className="text-[10px] opacity-75">Strict graph traversal</span>
                    </button>
                  </div>
                </div>

                {/* Accordions: Knowledge Base, Speech, Realtime Transcription */}
                <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
                  <button
                    onClick={() => setKbAccordionOpen(!kbAccordionOpen)}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
                  >
                    <span className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-teal-500" /> Knowledge Base
                    </span>
                    {kbAccordionOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  {kbAccordionOpen && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-slate-500 text-[11px] space-y-2">
                      <p>Attach documents or scraped URLs to augment LLM reasoning during calls.</p>
                      <button className="w-full py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-semibold text-indigo-600">
                        + Assign Knowledge Base
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => setSpeechAccordionOpen(!speechAccordionOpen)}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
                  >
                    <span className="flex items-center gap-2">
                      <Mic className="w-4 h-4 text-purple-500" /> Speech Settings
                    </span>
                    {speechAccordionOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  {speechAccordionOpen && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-slate-500 text-[11px] space-y-2">
                      <div>
                        <span>Speech Rate (Speed)</span>
                        <input type="range" min="0.8" max="1.4" step="0.1" defaultValue="1.0" className="w-full mt-1" />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setTranscriptionAccordionOpen(!transcriptionAccordionOpen)}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500" /> Realtime Transcription Settings
                    </span>
                    {transcriptionAccordionOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ) : (
              /* Node Settings Inspector */
              <div className="space-y-4">
                {selectedNode ? (() => {
                  const nodeData = (selectedNode.data || {}) as Record<string, any>;
                  return (
                    <>
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                        <p className="font-bold text-xs text-slate-800 dark:text-slate-200">
                          Edit Node Properties
                        </p>
                        <button
                          onClick={handleDeleteSelectedNode}
                          className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                          title="Delete Node"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">Step Label</label>
                          <input
                            type="text"
                            value={nodeData.label || ''}
                            onChange={(e) => updateSelectedNodeData({ label: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>

                        {(selectedNode.type === 'start' || selectedNode.type === 'conversation' || selectedNode.type === 'sayMessage' || selectedNode.type === 'ending' || selectedNode.type === 'endCall') && (
                          <div>
                            <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">Speech Text Payload</label>
                            <textarea
                              rows={4}
                              value={nodeData.text || nodeData.message || ''}
                              onChange={(e) => updateSelectedNodeData({ text: e.target.value, message: e.target.value })}
                              placeholder="Type what the agent should speak..."
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-mono"
                            />
                          </div>
                        )}

                        {/* Ask Question / Collect Input */}
                        {(selectedNode.type === 'askQuestion' || (selectedNode.type as string) === 'collectInput') && (
                          <div className="space-y-3">
                            <div>
                              <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">Question / Input Prompt</label>
                              <textarea
                                rows={3}
                                value={nodeData.question || nodeData.prompt || nodeData.text || ''}
                                onChange={(e) => updateSelectedNodeData({ question: e.target.value, prompt: e.target.value, text: e.target.value })}
                                placeholder="What should the agent ask the caller?"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-mono"
                              />
                            </div>
                            <div>
                              <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">Target Variable Name</label>
                              <input
                                type="text"
                                value={nodeData.variable || nodeData.variableName || ''}
                                onChange={(e) => updateSelectedNodeData({ variable: e.target.value, variableName: e.target.value })}
                                placeholder="e.g. accountNumber"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                              />
                            </div>
                          </div>
                        )}

                        {/* Check Calendar Availability */}
                        {selectedNode.type === 'checkCalendar' && (
                          <div className="space-y-3">
                            <div>
                              <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">Calendar Check Instructions</label>
                              <textarea
                                rows={3}
                                value={nodeData.text || nodeData.instructions || ''}
                                onChange={(e) => updateSelectedNodeData({ text: e.target.value, instructions: e.target.value })}
                                placeholder="Query open calendar slots before offering times to caller..."
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-mono"
                              />
                            </div>
                          </div>
                        )}

                        {/* Subagent */}
                        {selectedNode.type === 'subagent' && (
                          <div>
                            <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">Delegate Subagent Name</label>
                            <input
                              type="text"
                              value={nodeData.subagentName || ''}
                              onChange={(e) => updateSelectedNodeData({ subagentName: e.target.value })}
                              placeholder="e.g. Appointment Booking Subagent"
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                            />
                          </div>
                        )}

                        {/* Function / Call Tool */}
                        {(selectedNode.type === 'function' || selectedNode.type === 'callTool') && (
                          <div className="space-y-3">
                            <div>
                              <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">Tool / Function Name</label>
                              <input
                                type="text"
                                value={nodeData.toolName || ''}
                                onChange={(e) => updateSelectedNodeData({ toolName: e.target.value })}
                                placeholder="e.g. check_calendar_availability"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                              />
                            </div>
                            <div>
                              <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">Webhook Endpoint URL</label>
                              <input
                                type="text"
                                value={nodeData.url || ''}
                                onChange={(e) => updateSelectedNodeData({ url: e.target.value })}
                                placeholder="https://api.yourdomain.com/webhook"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                              />
                            </div>
                          </div>
                        )}

                        {/* Call Transfer */}
                        {selectedNode.type === 'transferCall' && (
                          <div>
                            <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">Transfer Phone Number</label>
                            <input
                              type="text"
                              value={nodeData.targetNumber || ''}
                              onChange={(e) => updateSelectedNodeData({ targetNumber: e.target.value })}
                              placeholder="+18005550199"
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                            />
                          </div>
                        )}

                        {/* Press Digit */}
                        {selectedNode.type === 'pressDigit' && (
                          <div>
                            <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">DTMF Key Digit (0-9, *, #)</label>
                            <input
                              type="text"
                              value={nodeData.digit || ''}
                              onChange={(e) => updateSelectedNodeData({ digit: e.target.value })}
                              placeholder="e.g. 1"
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                            />
                          </div>
                        )}

                        {/* Logic Split */}
                        {(selectedNode.type === 'logicSplit' || selectedNode.type === 'conditionBranch') && (
                          <div className="space-y-2">
                            <label className="font-semibold text-slate-600 dark:text-slate-400 block">Branching Variable</label>
                            <input
                              type="text"
                              value={nodeData.variable || ''}
                              onChange={(e) => updateSelectedNodeData({ variable: e.target.value })}
                              placeholder="e.g. user_intent or booking_requested"
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                            />
                          </div>
                        )}

                        {/* Agent Transfer */}
                        {selectedNode.type === 'agentTransfer' && (
                          <div>
                            <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">Specialist Agent Name</label>
                            <input
                              type="text"
                              value={nodeData.agentName || ''}
                              onChange={(e) => updateSelectedNodeData({ agentName: e.target.value })}
                              placeholder="e.g. Tier-2 Technical Support"
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                            />
                          </div>
                        )}

                        {/* In-Call SMS */}
                        {selectedNode.type === 'inCallSms' && (
                          <div>
                            <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">SMS Message Content</label>
                            <textarea
                              rows={3}
                              value={nodeData.smsBody || ''}
                              onChange={(e) => updateSelectedNodeData({ smsBody: e.target.value })}
                              placeholder="Here is your confirmation link: https://..."
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-mono"
                            />
                          </div>
                        )}

                        {/* Extract Variable */}
                        {selectedNode.type === 'extractVariable' && (
                          <div>
                            <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">Slot Variable Key</label>
                            <input
                              type="text"
                              value={nodeData.variableKey || ''}
                              onChange={(e) => updateSelectedNodeData({ variableKey: e.target.value })}
                              placeholder="e.g. customer_date_of_birth"
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                            />
                          </div>
                        )}

                        {/* Code */}
                        {selectedNode.type === 'code' && (
                          <div>
                            <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">Inline Code Block</label>
                            <textarea
                              rows={4}
                              value={nodeData.codeSnippet || ''}
                              onChange={(e) => updateSelectedNodeData({ codeSnippet: e.target.value })}
                              placeholder="// return { next_node: 'node-3' }"
                              className="w-full px-3 py-2 bg-slate-900 text-green-400 border border-slate-800 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-mono"
                            />
                          </div>
                        )}

                        {/* MCP */}
                        {selectedNode.type === 'mcp' && (
                          <div>
                            <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">MCP Server Endpoint</label>
                            <input
                              type="text"
                              value={nodeData.mcpServer || ''}
                              onChange={(e) => updateSelectedNodeData({ mcpServer: e.target.value })}
                              placeholder="mcp://server.yourdomain.com"
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                            />
                          </div>
                        )}

                        {/* Ending / EndCall */}
                        {(selectedNode.type === 'ending' || selectedNode.type === 'endCall') && (
                          <div>
                            <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">Goodbye Phrase</label>
                            <input
                              type="text"
                              value={nodeData.text || ''}
                              onChange={(e) => updateSelectedNodeData({ text: e.target.value })}
                              placeholder="Thank you for calling Claritiy Voice. Have a great day!"
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                            />
                          </div>
                        )}

                        {/* Note */}
                        {selectedNode.type === 'note' && (
                          <div>
                            <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">Note Annotation Text</label>
                            <textarea
                              rows={3}
                              value={nodeData.noteText || ''}
                              onChange={(e) => updateSelectedNodeData({ noteText: e.target.value })}
                              placeholder="Annotation note for developers..."
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-mono"
                            />
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()
 : (
                  <div className="p-8 text-center text-slate-400">
                    Click any node on the canvas to inspect and edit its properties.
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
