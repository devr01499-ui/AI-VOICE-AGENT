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
} from 'lucide-react';
import { FlowGraph, FlowNode, compileFlowToSystemPrompt } from './flowCompiler';

interface VisualFlowCanvasProps {
  initialGraph?: FlowGraph | null;
  legacySystemPrompt?: string;
  agentName?: string;
  onSave: (compiledPrompt: string, flowGraph: FlowGraph) => void;
}

// ── Custom Node Components for @xyflow/react ────────────────────────────

const CustomNodeLayout: React.FC<{
  title: string;
  icon: React.ReactNode;
  colorClass: string;
  selected?: boolean;
  children?: React.ReactNode;
}> = ({ title, icon, colorClass, selected, children }) => (
  <div
    className={`nm-card p-4 min-w-[220px] max-w-[280px] rounded-2xl transition-all shadow-lg ${
      selected ? 'ring-2 ring-[var(--nm-accent)] nm-pressed' : 'nm-raised'
    }`}
    style={{ fontFamily: "'Figtree', sans-serif" }}
  >
    <Handle type="target" position={Position.Top} className="w-3 h-3 bg-[var(--nm-accent)] border-2 border-white" />
    <div className="flex items-center gap-3 mb-2 pb-2 border-b border-border/40">
      <div className={`w-8 h-8 rounded-xl nm-pressed flex items-center justify-center ${colorClass}`}>
        {icon}
      </div>
      <p className="font-bold text-xs text-[var(--nm-text)] truncate">{title}</p>
    </div>
    <div className="text-[11px] text-muted-foreground space-y-1">{children}</div>
    <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-[var(--nm-accent)] border-2 border-white" />
  </div>
);

const nodeTypes = {
  sayMessage: ({ data, selected }: any) => (
    <CustomNodeLayout title={data.label || 'Say Message'} icon={<MessageSquare className="w-4 h-4 text-blue-500" />} colorClass="bg-blue-500/10" selected={selected}>
      <p className="line-clamp-2 italic">"{data.text || 'No message set'}"</p>
    </CustomNodeLayout>
  ),
  askQuestion: ({ data, selected }: any) => (
    <CustomNodeLayout title={data.label || 'Ask Question'} icon={<HelpCircle className="w-4 h-4 text-amber-500" />} colorClass="bg-amber-500/10" selected={selected}>
      <p className="line-clamp-2 italic">"{data.question || data.text || 'No question set'}"</p>
    </CustomNodeLayout>
  ),
  conditionBranch: ({ data, selected }: any) => (
    <CustomNodeLayout title={data.label || 'Condition Branch'} icon={<GitBranch className="w-4 h-4 text-purple-500" />} colorClass="bg-purple-500/10" selected={selected}>
      <p className="font-semibold text-[10px] uppercase text-purple-600">Branch Logic</p>
      <p className="text-[10px] truncate">Variable: {data.variable || 'user_intent'}</p>
    </CustomNodeLayout>
  ),
  transferCall: ({ data, selected }: any) => (
    <CustomNodeLayout title={data.label || 'Transfer Call'} icon={<PhoneForwarded className="w-4 h-4 text-green-500" />} colorClass="bg-green-500/10" selected={selected}>
      <p className="font-mono text-[10px]">{data.targetNumber || '+18005550199'}</p>
    </CustomNodeLayout>
  ),
  endCall: ({ data, selected }: any) => (
    <CustomNodeLayout title={data.label || 'End Call'} icon={<PhoneOff className="w-4 h-4 text-red-500" />} colorClass="bg-red-500/10" selected={selected}>
      <p className="line-clamp-1 italic">"{data.text || 'Goodbye!'}"</p>
    </CustomNodeLayout>
  ),
  checkCalendar: ({ data, selected }: any) => (
    <CustomNodeLayout title={data.label || 'Check Calendar'} icon={<Calendar className="w-4 h-4 text-teal-500" />} colorClass="bg-teal-500/10" selected={selected}>
      <p className="text-[10px]">Google Calendar Availability</p>
    </CustomNodeLayout>
  ),
  callTool: ({ data, selected }: any) => (
    <CustomNodeLayout title={data.label || 'Call API / Tool'} icon={<Wrench className="w-4 h-4 text-indigo-500" />} colorClass="bg-indigo-500/10" selected={selected}>
      <p className="font-mono text-[10px]">{data.toolName || 'webhook_handler'}</p>
    </CustomNodeLayout>
  ),
};

export default function VisualFlowCanvas({
  initialGraph,
  legacySystemPrompt,
  agentName = 'Voice Agent',
  onSave,
}: VisualFlowCanvasProps) {
  // Backwards compatibility default graph seed
  const defaultNodes: Node[] = [
    {
      id: 'node-1',
      type: 'sayMessage',
      position: { x: 250, y: 50 },
      data: { label: 'Greeting', text: 'Hello! Thank you for calling Claritiy Voice Support. How can I help you today?' },
    },
    {
      id: 'node-2',
      type: 'askQuestion',
      position: { x: 250, y: 200 },
      data: { label: 'Collect Request', question: 'Could you please describe your issue or request?' },
    },
    {
      id: 'node-3',
      type: 'conditionBranch',
      position: { x: 250, y: 350 },
      data: { label: 'Route Intent', variable: 'user_intent' },
    },
    {
      id: 'node-4',
      type: 'endCall',
      position: { x: 250, y: 500 },
      data: { label: 'End Call', text: 'Thank you for calling Claritiy Voice. Have a wonderful day!' },
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
        position: n.position || { x: 250, y: 100 },
        data: n.data || { label: 'Step' },
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
  const [viewMode, setViewMode] = useState<'canvas' | 'prompt'>('canvas');
  const [isConvertedFromLegacy, setIsConvertedFromLegacy] = useState(false);

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
    return compileFlowToSystemPrompt(currentFlowGraph, agentName);
  }, [currentFlowGraph, agentName]);

  const promptCharCount = compiledPrompt.length;
  const promptMaxCeiling = 8000;
  const isNearCeiling = promptCharCount > 6000;

  const handleAddNode = (type: FlowNode['type'], label: string) => {
    const newId = `node-${Date.now()}`;
    const newNode: Node = {
      id: newId,
      type,
      position: { x: 250 + Math.random() * 50, y: 150 + nodes.length * 80 },
      data: {
        label,
        text: type === 'sayMessage' ? 'Sample speech payload' : undefined,
        question: type === 'askQuestion' ? 'How can I assist you today?' : undefined,
        targetNumber: type === 'transferCall' ? '+18005550199' : undefined,
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(newId);
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
  };

  const handleTriggerSave = () => {
    onSave(compiledPrompt, currentFlowGraph);
  };

  // Convert legacy non-graph prompt to graph preview
  const handleConvertLegacyToFlow = () => {
    if (!legacySystemPrompt) return;
    const lines = legacySystemPrompt.split('\n').filter((l) => l.trim().length > 0);
    const generatedNodes: Node[] = [
      {
        id: 'node-legacy-1',
        type: 'sayMessage',
        position: { x: 250, y: 80 },
        data: { label: 'Greeting', text: 'Hello! Thank you for calling Claritiy Voice.' },
      },
      {
        id: 'node-legacy-2',
        type: 'askQuestion',
        position: { x: 250, y: 220 },
        data: { label: 'System Instructions', question: lines.slice(0, 3).join(' ') },
      },
      {
        id: 'node-legacy-3',
        type: 'endCall',
        position: { x: 250, y: 380 },
        data: { label: 'Goodbye', text: 'Thank you for your time!' },
      },
    ];
    const generatedEdges: Edge[] = [
      { id: 'el-1-2', source: 'node-legacy-1', target: 'node-legacy-2', animated: true },
      { id: 'el-2-3', source: 'node-legacy-2', target: 'node-legacy-3', animated: true },
    ];
    setNodes(generatedNodes);
    setEdges(generatedEdges);
    setIsConvertedFromLegacy(true);
  };

  return (
    <div className="nm-card p-4 flex flex-col h-[700px] relative overflow-hidden">
      {/* Header Toolbar Ribbon */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/40 gap-4 flex-wrap z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 nm-pressed rounded-xl flex items-center justify-center">
            <Layers className="w-5 h-5 text-[var(--nm-accent)]" />
          </div>
          <div>
            <p className="text-base font-bold text-[var(--nm-text)]" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Visual Conversation Canvas
            </p>
            <p className="text-xs text-muted-foreground font-semibold">
              Retell-Style Node Builder • Schema v1
            </p>
          </div>
        </div>

        {/* Building Blocks Ribbon */}
        <div className="flex items-center gap-1.5 bg-muted/20 p-1.5 rounded-xl border border-border/40 overflow-x-auto">
          <button
            onClick={() => handleAddNode('sayMessage', 'Say Message')}
            className="nm-raised hover:nm-pressed px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 text-[var(--nm-text)]"
            title="Agent speaks a message"
          >
            <MessageSquare className="w-3.5 h-3.5 text-blue-500" /> Message
          </button>

          <button
            onClick={() => handleAddNode('askQuestion', 'Ask Question')}
            className="nm-raised hover:nm-pressed px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 text-[var(--nm-text)]"
            title="Ask prompt and listen for user response"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-500" /> Question
          </button>

          <button
            onClick={() => handleAddNode('conditionBranch', 'Condition Branch')}
            className="nm-raised hover:nm-pressed px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 text-[var(--nm-text)]"
            title="Branch flow based on intent/criteria"
          >
            <GitBranch className="w-3.5 h-3.5 text-purple-500" /> Branch
          </button>

          <button
            onClick={() => handleAddNode('transferCall', 'Transfer Call')}
            className="nm-raised hover:nm-pressed px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 text-[var(--nm-text)]"
            title="Transfer call to human operator"
          >
            <PhoneForwarded className="w-3.5 h-3.5 text-green-500" /> Transfer
          </button>

          <button
            onClick={() => handleAddNode('checkCalendar', 'Check Calendar')}
            className="nm-raised hover:nm-pressed px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 text-[var(--nm-text)]"
            title="Query Google Calendar availability"
          >
            <Calendar className="w-3.5 h-3.5 text-teal-500" /> Calendar
          </button>

          <button
            onClick={() => handleAddNode('callTool', 'Call API Tool')}
            className="nm-raised hover:nm-pressed px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 text-[var(--nm-text)]"
            title="Trigger dynamic HTTP tool/webhook"
          >
            <Wrench className="w-3.5 h-3.5 text-indigo-500" /> API Tool
          </button>

          <button
            onClick={() => handleAddNode('endCall', 'End Call')}
            className="nm-raised hover:nm-pressed px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 text-[var(--nm-text)]"
            title="Gracefully end call session"
          >
            <PhoneOff className="w-3.5 h-3.5 text-red-500" /> End Call
          </button>
        </div>

        {/* View mode toggle & Save action */}
        <div className="flex items-center gap-2">
          <div className="nm-pressed p-1 rounded-xl flex gap-1 text-xs">
            <button
              onClick={() => setViewMode('canvas')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                viewMode === 'canvas' ? 'nm-raised text-[var(--nm-accent)]' : 'text-muted-foreground'
              }`}
            >
              Canvas View
            </button>
            <button
              onClick={() => setViewMode('prompt')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                viewMode === 'prompt' ? 'nm-raised text-[var(--nm-accent)]' : 'text-muted-foreground'
              }`}
            >
              Compiler Preview
            </button>
          </div>

          <button
            onClick={handleTriggerSave}
            className="nm-button px-4 py-2 text-xs font-bold text-[var(--nm-text)] hover:text-[var(--nm-accent)] flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--nm-accent)]" /> Save Visual Flow
          </button>
        </div>
      </div>

      {/* Legacy Non-Graph Conversion Alert Banner */}
      {!initialGraph && legacySystemPrompt && !isConvertedFromLegacy && (
        <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl mb-3 flex items-center justify-between z-10 text-xs">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>This existing agent was created with text prompt mode. Convert it into a visual node flow graph?</span>
          </div>
          <button
            onClick={handleConvertLegacyToFlow}
            className="nm-raised hover:nm-pressed px-3 py-1.5 rounded-lg font-bold text-xs text-[var(--nm-text)] flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3 text-[var(--nm-accent)]" /> Convert to Visual Flow
          </button>
        </div>
      )}

      {/* Main Canvas Body / Compiler Preview Split */}
      <div className="flex-1 flex relative rounded-2xl overflow-hidden border border-border/40">
        {viewMode === 'canvas' ? (
          <div className="flex-1 flex relative">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              fitView
              className="bg-muted/5"
            >
              <Controls />
              <MiniMap />
              <Background color="#ccc" gap={16} />
            </ReactFlow>

            {/* Properties Panel for Selected Node */}
            {selectedNode && (
              <div className="w-72 border-l border-border/40 nm-card p-4 space-y-4 overflow-y-auto z-10 animate-in slide-in-from-right-2 duration-200">
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <p className="font-bold text-xs text-[var(--nm-text)]" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    Node Properties
                  </p>
                  <button
                    onClick={handleDeleteSelectedNode}
                    className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                    title="Delete Node"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 text-xs" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  <div>
                    <label className="font-bold text-muted-foreground block mb-1">Step Label</label>
                    <input
                      type="text"
                      value={selectedNode.data.label || ''}
                      onChange={(e) => updateSelectedNodeData({ label: e.target.value })}
                      className="nm-input w-full px-3 py-2 text-xs rounded-xl focus:outline-none"
                    />
                  </div>

                  {(selectedNode.type === 'sayMessage' || selectedNode.type === 'endCall') && (
                    <div>
                      <label className="font-bold text-muted-foreground block mb-1">Speech Text Payload</label>
                      <textarea
                        rows={4}
                        value={selectedNode.data.text || ''}
                        onChange={(e) => updateSelectedNodeData({ text: e.target.value })}
                        placeholder="Type what the agent should speak..."
                        className="nm-input w-full px-3 py-2 text-xs rounded-xl focus:outline-none resize-none"
                      />
                    </div>
                  )}

                  {selectedNode.type === 'askQuestion' && (
                    <div>
                      <label className="font-bold text-muted-foreground block mb-1">Question Prompt</label>
                      <textarea
                        rows={3}
                        value={selectedNode.data.question || selectedNode.data.text || ''}
                        onChange={(e) => updateSelectedNodeData({ question: e.target.value })}
                        placeholder="What should the agent ask the caller?"
                        className="nm-input w-full px-3 py-2 text-xs rounded-xl focus:outline-none resize-none"
                      />
                    </div>
                  )}

                  {selectedNode.type === 'conditionBranch' && (
                    <div className="space-y-2">
                      <label className="font-bold text-muted-foreground block">Branching Variable</label>
                      <input
                        type="text"
                        value={selectedNode.data.variable || ''}
                        onChange={(e) => updateSelectedNodeData({ variable: e.target.value })}
                        placeholder="e.g. user_intent or account_tier"
                        className="nm-input w-full px-3 py-2 text-xs rounded-xl focus:outline-none"
                      />
                    </div>
                  )}

                  {selectedNode.type === 'transferCall' && (
                    <div>
                      <label className="font-bold text-muted-foreground block mb-1">Target Phone Number</label>
                      <input
                        type="text"
                        value={selectedNode.data.targetNumber || ''}
                        onChange={(e) => updateSelectedNodeData({ targetNumber: e.target.value })}
                        placeholder="+18005550199"
                        className="nm-input w-full px-3 py-2 text-xs rounded-xl focus:outline-none font-mono"
                      />
                    </div>
                  )}

                  {selectedNode.type === 'callTool' && (
                    <div>
                      <label className="font-bold text-muted-foreground block mb-1">Tool Name</label>
                      <input
                        type="text"
                        value={selectedNode.data.toolName || ''}
                        onChange={(e) => updateSelectedNodeData({ toolName: e.target.value })}
                        placeholder="e.g. check_inventory"
                        className="nm-input w-full px-3 py-2 text-xs rounded-xl focus:outline-none font-mono"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Compiler Preview View */
          <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-muted/5 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-[var(--nm-accent)]" />
                <span className="font-bold text-sm text-[var(--nm-text)]">Compiled System Prompt Preview</span>
              </div>
              <div className="flex items-center gap-2">
                {isNearCeiling && (
                  <span className="text-amber-500 flex items-center gap-1 font-sans text-xs">
                    <AlertTriangle className="w-3.5 h-3.5" /> Prompt approaching length ceiling
                  </span>
                )}
                <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                  isNearCeiling ? 'bg-amber-500/20 text-amber-600' : 'bg-green-500/20 text-green-600'
                }`}>
                  {promptCharCount} / {promptMaxCeiling} chars
                </span>
              </div>
            </div>
            <pre className="whitespace-pre-wrap text-muted-foreground leading-relaxed p-4 nm-pressed rounded-xl">
              {compiledPrompt}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
