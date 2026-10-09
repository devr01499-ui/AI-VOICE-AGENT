/**
 * Claritiy Voice Server — Flow Graph Compiler
 *
 * Compiles a visual directed node-and-edge conversational flow graph
 * into an executable, deterministic system prompt for LLM execution.
 *
 * Traversal Protocol:
 * 1. Analyzes graph edges to compute in-degrees and outgoing transitions.
 * 2. Follows arrows starting from start/root nodes in topological order.
 * 3. Compiles conditional branches (if user says yes -> step A; if no -> step B).
 * 4. Injects explicit tool execution protocols and direction guidance.
 */

export interface FlowNodeData {
  label?: string;
  text?: string;
  question?: string;
  prompt?: string;
  message?: string;
  variable?: string;
  variableName?: string;
  instructions?: string;
  branches?: Array<{ condition: string; targetNodeId: string }>;
  targetNumber?: string;
  toolName?: string;
  digits?: string;
  smsMessage?: string;
  [key: string]: any;
}

export interface FlowNode {
  id: string;
  type: string;
  data?: FlowNodeData;
  transitions?: Array<{
    condition: string;
    targetId: string;
  }>;
}

export interface FlowEdge {
  id?: string;
  source: string;
  target: string;
  label?: string;
  condition?: string;
}

export interface FlowGraphStructure {
  schemaVersion?: number;
  nodes: FlowNode[];
  edges?: FlowEdge[];
  flexibilityMode?: 'flex' | 'rigid';
  direction?: 'inbound' | 'outbound' | 'both';
}

export function compileFlowToPrompt(
  agentName: string = 'Claritiy Voice Agent',
  nodes: FlowNode[],
  edges: FlowEdge[] = [],
  flexibilityMode: 'flex' | 'rigid' = 'rigid',
  direction: 'inbound' | 'outbound' | 'both' = 'outbound'
): string {
  if (!nodes || nodes.length === 0) {
    return `You are ${agentName}, an advanced Conversational Voice AI agent for Claritiy Voice. Answer caller queries concisely, professionally, and naturally.`;
  }

  // 1. Filter out non-executable nodes (e.g. notes)
  const executableNodes = nodes.filter((n) => n.type !== 'note');
  if (executableNodes.length === 0) {
    return `You are ${agentName}, an advanced Conversational Voice AI agent for Claritiy Voice.`;
  }

  const nodeMap = new Map<string, FlowNode>();
  const inDegree = new Map<string, number>();
  const outgoingMap = new Map<string, Array<{ target: string; condition?: string }>>();

  executableNodes.forEach((n) => {
    nodeMap.set(n.id, n);
    inDegree.set(n.id, 0);
    outgoingMap.set(n.id, []);
  });

  // Wire edges from visual flow builder
  const validEdges = (edges || []).filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target));
  validEdges.forEach((e) => {
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    const existing = outgoingMap.get(e.source) || [];
    existing.push({
      target: e.target,
      condition: e.label || e.condition,
    });
    outgoingMap.set(e.source, existing);
  });

  // Also incorporate any embedded node.transitions (legacy or inline format)
  executableNodes.forEach((n) => {
    if (n.transitions && n.transitions.length > 0) {
      const existing = outgoingMap.get(n.id) || [];
      n.transitions.forEach((t) => {
        if (nodeMap.has(t.targetId)) {
          inDegree.set(t.targetId, (inDegree.get(t.targetId) || 0) + 1);
          existing.push({
            target: t.targetId,
            condition: t.condition,
          });
        }
      });
      outgoingMap.set(n.id, existing);
    }
  });

  // 2. Determine topological traversal order starting from start nodes or 0-in-degree nodes
  const orderedNodes: FlowNode[] = [];
  const visited = new Set<string>();

  const rootNodes = executableNodes.filter(
    (n) => n.type === 'start' || inDegree.get(n.id) === 0 || n.id.toLowerCase().includes('welcome')
  );
  const queue: FlowNode[] = rootNodes.length > 0 ? [...rootNodes] : [executableNodes[0]];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (visited.has(curr.id)) continue;
    visited.add(curr.id);
    orderedNodes.push(curr);

    const outgoing = outgoingMap.get(curr.id) || [];
    for (const edge of outgoing) {
      const targetNode = nodeMap.get(edge.target);
      if (targetNode && !visited.has(targetNode.id)) {
        queue.push(targetNode);
      }
    }
  }

  // Append any unreachable/disconnected nodes
  executableNodes.forEach((n) => {
    if (!visited.has(n.id)) {
      visited.add(n.id);
      orderedNodes.push(n);
    }
  });

  // Map each node ID to its 1-indexed step number
  const nodeStepMap = new Map<string, number>();
  orderedNodes.forEach((n, idx) => {
    nodeStepMap.set(n.id, idx + 1);
  });

  const getStepRef = (targetId: string): string => {
    const targetNode = nodeMap.get(targetId);
    const stepNum = nodeStepMap.get(targetId);
    if (!targetNode || !stepNum) return `Node [${targetId}]`;
    const label = targetNode.data?.label || targetNode.id;
    return `STEP ${stepNum} ("${label}")`;
  };

  // 3. Assemble Master Prompt
  let prompt = `# AGENT IDENTITY & ROLE\n`;
  prompt += `You are an autonomous AI voice agent (${agentName}) for Claritiy Voice executing a visual state-machine conversational flow.\n\n`;

  // Direction guidance
  if (direction === 'inbound') {
    prompt += `# CALL DIRECTION RULES (INBOUND)\n`;
    prompt += `The caller initiated this call. Open by introducing yourself and asking how you can help. Never deliver an unsolicited sales pitch.\n\n`;
  } else if (direction === 'outbound') {
    prompt += `# CALL DIRECTION RULES (OUTBOUND)\n`;
    prompt += `You are initiating this outbound call. State who you are and why you are calling within the first two sentences. Respect caller objections politely.\n\n`;
  }

  // Flexibility mode
  prompt += `# FLOW EXECUTION INSTRUCTIONS\n`;
  if (flexibilityMode === 'flex') {
    prompt += `Use this state machine as a flexible guide. Adapt naturally if the caller answers questions out of order, and steer conversation toward the flow objectives.\n\n`;
  } else {
    prompt += `You MUST strictly follow this graph step-by-step in the sequence and branches defined below. Transition between steps based on user response and evaluated conditions.\n\n`;
  }

  prompt += `# CONVERSATION STEPS & BRANCHING LOGIC\n`;

  orderedNodes.forEach((node, index) => {
    const stepNum = index + 1;
    const data = node.data || {};
    const outgoing = outgoingMap.get(node.id) || [];
    const label = data.label || node.id;
    const spokenText = data.text || data.message || data.prompt || data.question || '';

    prompt += `\n## STEP ${stepNum}: ${label} [Node ID: ${node.id}, Type: ${node.type}]\n`;

    if (spokenText) {
      prompt += `- MESSAGE TO SPEAK: "${spokenText}"\n`;
    }

    if (data.variable || data.variableName) {
      prompt += `- CAPTURE VARIABLE: Record caller response as '${data.variable || data.variableName}'.\n`;
    }

    // Branching evaluation
    if (node.type === 'logicSplit' || node.type === 'conditionBranch' || outgoing.length > 1) {
      prompt += `- EVALUATE BRANCHING:\n`;
      outgoing.forEach((edge, eIdx) => {
        const conditionText = edge.condition || `Branch Option ${eIdx + 1}`;
        prompt += `  * If caller intent matches "${conditionText}": Proceed to ${getStepRef(edge.target)}.\n`;
      });
      if (outgoing.length === 0) {
        prompt += `  * Evaluate caller intent and proceed accordingly.\n`;
      }
    } else if (outgoing.length === 1) {
      prompt += `- NEXT STEP: Proceed to ${getStepRef(outgoing[0].target)}.\n`;
    } else {
      prompt += `- NEXT STEP: End of flow path.\n`;
    }

    // Node-specific action notes
    if (node.type === 'ending' || node.type === 'endCall') {
      prompt += `- ACTION: Politely conclude the conversation and invoke the end call protocol.\n`;
    } else if (node.type === 'checkCalendar') {
      prompt += `- ACTION: Query availability and suggest open slots to caller.\n`;
    } else if (node.type === 'transferCall') {
      prompt += `- ACTION: Politely inform the caller that transfer is being scheduled, take down callback details, and follow up.\n`;
    }
  });

  prompt += `\n# BEHAVIORAL PROTOCOLS\n`;
  prompt += `1. Speak with natural human cadence, clear tone, and sub-200ms conversational timing.\n`;
  prompt += `2. Never read out step numbers, node IDs, or internal state machine headers to the caller.\n`;
  prompt += `3. Begin at STEP 1. Speak the initial message naturally.\n`;

  return prompt;
}

/**
 * Main compilation entrypoint called by CallOrchestrator and SandboxStreamHandler.
 */
export function compile(
  flowGraph: string | object,
  agentName: string = 'Claritiy AI',
  flexibilityMode?: 'flex' | 'rigid',
  direction?: 'inbound' | 'outbound' | 'both'
): string {
  if (!flowGraph || flowGraph === '' || flowGraph === '{}') {
    return `You are ${agentName}, a professional corporate voice assistant for Claritiy Voice.`;
  }

  let parsed: any;
  if (typeof flowGraph === 'string') {
    try {
      parsed = JSON.parse(flowGraph);
    } catch {
      return `You are ${agentName}, a professional corporate voice assistant for Claritiy Voice.`;
    }
  } else {
    parsed = flowGraph;
  }

  if (!parsed || !Array.isArray(parsed.nodes)) {
    return `You are ${agentName}, a professional corporate voice assistant for Claritiy Voice.`;
  }

  const mode = flexibilityMode || parsed.flexibilityMode || 'rigid';
  const callDirection = direction || parsed.direction || 'outbound';
  const edges = Array.isArray(parsed.edges) ? parsed.edges : [];

  return compileFlowToPrompt(agentName, parsed.nodes, edges, mode, callDirection);
}
