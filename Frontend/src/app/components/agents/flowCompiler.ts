import { stripGeneratedPromptBlocks } from './promptBlocks';

/**
 * Key of a live-call route (a flow node's id), as lower-case letters, digits and underscores (max 40).
 * Identical to server/src/runtime/routeKey.ts (server test_call_transfer checks they agree): the
 * compiled step names the same key that the server maps to the saved number, agent or template.
 */
export function routeKey(raw: unknown): string {
  let k = String(raw ?? '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  if (!k) k = 'route';
  if (/^[0-9]/.test(k)) k = `r_${k}`.slice(0, 40);
  return k;
}

export interface FlowNodeData {
  label: string;
  text?: string;
  question?: string;
  prompt?: string;
  variable?: string;
  variableName?: string;
  /** Extract Variable node's slot key. */
  variableKey?: string;
  instructions?: string;
  branches?: Array<{ condition: string; targetNodeId: string }>;
  targetNumber?: string;
  toolName?: string;
  digits?: string;
  smsMessage?: string;
  /** WhatsApp node: approved template name, its language and one entry per body variable. */
  templateName?: string;
  language?: string;
  variables?: Array<{ description?: string; fixedValue?: string }>;
  /** Transfer node: what the caller hears if nobody answers. Agent node: the chosen agent. */
  fallbackMessage?: string;
  targetAgentId?: string;
  codeSnippet?: string;
  mcpServer?: string;
  subagentName?: string;
  noteText?: string;
  [key: string]: any;
}


export type FlowNodeType =
  | 'start'
  | 'conversation'
  | 'sayMessage'
  | 'askQuestion'
  | 'collectInput'
  | 'subagent'
  | 'callTool'
  | 'function'
  | 'transferCall'
  | 'pressDigit'
  | 'conditionBranch'
  | 'logicSplit'
  | 'agentTransfer'
  | 'inCallSms'
  | 'whatsapp'
  | 'extractVariable'
  | 'code'
  | 'mcp'
  | 'endCall'
  | 'ending'
  | 'note'
  | 'checkCalendar';


export interface FlowNode {
  id: string;
  type: FlowNodeType;
  position: { x: number; y: number };
  data: FlowNodeData;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface FlowGraph {
  schemaVersion: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/** Start of every compiled flow prompt (same text in the server's FlowCompiler). */
export const FLOW_PROMPT_HEADER = '# AGENT IDENTITY & ROLE\nYou are an autonomous AI voice agent (';
/** Old builds stored this hint as the global prompt's value; it must never reach a live call. */
export const GLOBAL_PROMPT_PLACEHOLDER = 'Enter your global prompt here. Type {{ to add dynamic variables.';

/**
 * Recovers the user's own global prompt from a saved flow agent's systemPrompt (agents saved
 * before `agentConfig.flowSettings.globalPrompt` existed). The saved text is
 * "<global prompt>\n\n<compiled flow>\n\n<direction/handbook>"; only the first part is the user's.
 * Cutting at the FIRST compiled-flow header also undoes the old bug where each save nested
 * another copy of the whole prompt inside the global prompt.
 */
export function extractFlowGlobalPrompt(saved?: string | null): string {
  if (!saved) return '';
  let text = saved;
  const idx = text.indexOf(FLOW_PROMPT_HEADER);
  if (idx >= 0) text = text.slice(0, idx);
  // Only the generated lines come off; anything the customer typed after them is kept.
  return stripGeneratedPromptBlocks(text)
    .split(GLOBAL_PROMPT_PLACEHOLDER).join('')
    .trim();
}

/**
 * Compiles a visual FlowGraph JSON into a structured, executable system prompt for Gemini Live engine.
 * Implements topological traversal following graph edges and resolves node target IDs into step labels.
 */
export function compileFlowToSystemPrompt(
  flow: FlowGraph,
  agentName: string = "AI Voice Agent",
  direction: string = 'outbound',
  flexibilityMode: 'flex' | 'rigid' = 'rigid'
): string {
  if (!flow || !flow.nodes || flow.nodes.length === 0) {
    return `You are ${agentName}, a professional AI voice agent for Claritiy Voice. Answer user queries concisely and professionally.`;
  }

  // 1. Filter out non-execution nodes (notes)
  const executableNodes = flow.nodes.filter(n => n.type !== 'note');
  if (executableNodes.length === 0) {
    return `You are ${agentName}, a professional AI voice agent for Claritiy Voice. Answer user queries concisely and professionally.`;
  }

  const nodeMap = new Map<string, FlowNode>();
  const inDegree = new Map<string, number>();
  const outgoingMap = new Map<string, FlowEdge[]>();

  executableNodes.forEach(n => {
    nodeMap.set(n.id, n);
    inDegree.set(n.id, 0);
    outgoingMap.set(n.id, []);
  });

  const validEdges = (flow.edges || []).filter(e => nodeMap.has(e.source) && nodeMap.has(e.target));

  validEdges.forEach(e => {
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    const existing = outgoingMap.get(e.source) || [];
    existing.push(e);
    outgoingMap.set(e.source, existing);
  });

  // Determine traversal order starting from 'start' nodes or in-degree 0 nodes
  const orderedNodes: FlowNode[] = [];
  const visited = new Set<string>();

  // Roots: start nodes first, then other 0 in-degree nodes
  const rootNodes = executableNodes.filter(n => n.type === 'start' || (inDegree.get(n.id) === 0));
  const queue: FlowNode[] = [...rootNodes];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (visited.has(curr.id)) continue;
    visited.add(curr.id);
    orderedNodes.push(curr);

    const edges = outgoingMap.get(curr.id) || [];
    for (const edge of edges) {
      const targetNode = nodeMap.get(edge.target);
      if (targetNode && !visited.has(targetNode.id)) {
        queue.push(targetNode);
      }
    }
  }

  // Append any disconnected nodes not reached in main traversal
  executableNodes.forEach(n => {
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
    if (!targetNode || !stepNum) return `node ${targetId}`;
    return `STEP ${stepNum} ("${targetNode.data.label || targetNode.id}")`;
  };

  let prompt = `# AGENT IDENTITY & ROLE\n`;
  prompt += `You are an autonomous AI voice agent (${agentName}) for Claritiy Voice operating under a visual multi-step conversational flow graph.\n\n`;

  let directionText = '';
  if (direction === 'inbound') {
    directionText = "This is an inbound call — the caller reached out to you. Never introduce an unprompted sales pitch or reason for calling, as the caller already has a reason for reaching out. Open by identifying the business/agent and inviting them to share what they need. Listen for and directly address what they say before offering anything else. If they seem to be waiting or the greeting overlaps with hold time, keep the opening brief and get to 'how can I help' quickly.";
  } else if (direction === 'outbound') {
    directionText = "This is an outbound call you are initiating. Keep your opening brief and state who's calling and why within the first two sentences (people who didn't request the call have short patience). If the person sounds uninterested, busy, or asks to not be called again, acknowledge respectfully and offer to end the call or follow up later rather than pushing to continue. Never claim the person asked for this call. If asked 'how did you get my number', give an honest, direct answer if your context/prompt provides one, otherwise say a team member can follow up with that detail. Keep pitching proportionate — one clear value statement, not repeated re-pitching if the person has already responded neutrally or negatively.";
  } else if (direction === 'both') {
    directionText = "This agent handles both inbound and outbound calls. Rely on the agent's prompt and let context (how the call started) guide tone naturally without forced direction framing.";
  }

  if (directionText) {
    prompt += `# CALL DIRECTION INSTRUCTIONS\n${directionText}\n\n`;
  }

  prompt += `# CONVERSATIONAL EXECUTION INSTRUCTIONS\n`;
  if (flexibilityMode === 'flex') {
    prompt += `Use this dialogue flow as a flexible guide. Adapt naturally to what the caller says — if the caller naturally covers a later step early, skip ahead rather than re-asking, and handle off-script questions gracefully while steering back to the goal.\n\n`;
  } else {
    prompt += `You MUST strictly execute the following step-by-step dialogue flow. Guide the caller through each step in sequence and evaluate branching conditions based on user responses.\n\n`;
  }

  orderedNodes.forEach((node, index) => {
    const stepNum = index + 1;
    const data = node.data;
    const outgoing = outgoingMap.get(node.id) || [];
    const defaultNextTarget = outgoing[0]?.target;

    switch (node.type) {
      case 'start':
      case 'conversation':
      case 'sayMessage':
        prompt += `## STEP ${stepNum}: ${data.label || 'Conversation'} [Type: Say Message]\n`;
        prompt += `- ACTION: Speak the following message:\n  "${data.text || data.message || 'Hello! How can I assist you today?'}"\n`;
        if (defaultNextTarget) {
          prompt += `- NEXT STEP: Proceed to ${getStepRef(defaultNextTarget)}.\n\n`;
        } else {
          prompt += `- NEXT STEP: Proceed to the next step in sequence.\n\n`;
        }
        break;

      case 'askQuestion':
      case 'collectInput':
        prompt += `## STEP ${stepNum}: ${data.label || 'Collect Input'} [Type: Ask Question / Collect Input]\n`;
        prompt += `- ACTION: Ask the caller:\n  "${data.question || data.prompt || data.text || ''}"\n`;
        if (data.variable || data.variableName) {
          prompt += `- VARIABLE: Store answer as '${data.variable || data.variableName}'\n`;
        }
        if (defaultNextTarget) {
          prompt += `- WAIT: Listen to response, record intent/variables, then proceed to ${getStepRef(defaultNextTarget)}.\n\n`;
        } else {
          prompt += `- WAIT: Listen to response, record intent/variables, and proceed.\n\n`;
        }
        break;

      case 'subagent':
      case 'agentTransfer':
        prompt += `## STEP ${stepNum}: ${data.label || 'Subagent Transfer'} [Type: Agent Transfer]\n`;
        prompt += `- ACTION: Say you are connecting the caller to a specialist (${data.subagentName || data.label}), then call agent_transfer with target "${routeKey(node.id)}" and a summary of what the caller needs.\n\n`;
        break;

      case 'function':
      case 'callTool':
        prompt += `## STEP ${stepNum}: ${data.label || 'Execute Tool'} [Type: Function Call]\n`;
        prompt += `- ACTION: Execute dynamic tool operation (${data.toolName || 'webhook_handler'}).\n`;
        if (defaultNextTarget) {
          prompt += `- NEXT STEP: After tool execution, proceed to ${getStepRef(defaultNextTarget)}.\n\n`;
        } else {
          prompt += `\n`;
        }
        break;

      case 'transferCall':
        prompt += `## STEP ${stepNum}: ${data.label || 'Transfer Call'} [Type: Call Transfer]\n`;
        prompt += `- ACTION: Say you are connecting the caller to ${data.label || 'the team'} and ask them to stay on the line, then call transfer_call with destination "${routeKey(node.id)}".\n\n`;
        break;

      case 'pressDigit':
        prompt += `## STEP ${stepNum}: ${data.label || 'Press Digit'} [Type: DTMF Keypad]\n`;
        prompt += `- ACTION: Play IVR key tone or capture keypad digits (${data.digits || '1'}).\n\n`;
        break;

      case 'logicSplit':
      case 'conditionBranch':
        prompt += `## STEP ${stepNum}: ${data.label || 'Logic Split'} [Type: Condition Branch]\n`;
        prompt += `- ACTION: Evaluate caller response against branching criteria${data.variable ? ` (based on '${data.variable}')` : ''}:\n`;
        if (data.branches && data.branches.length > 0) {
          data.branches.forEach((b, bIdx) => {
            const targetRef = getStepRef(b.targetNodeId);
            prompt += `  * BRANCH ${String.fromCharCode(65 + bIdx)} (If ${b.condition}): Proceed to ${targetRef}.\n`;
          });
        } else if (outgoing.length > 0) {
          outgoing.forEach((edge, eIdx) => {
            const label = edge.label || `Condition ${eIdx + 1}`;
            prompt += `  * BRANCH ${String.fromCharCode(65 + eIdx)} (If ${label}): Proceed to ${getStepRef(edge.target)}.\n`;
          });
        } else {
          prompt += `  * Evaluate intent and transition to the appropriate branch.\n`;
        }
        prompt += `\n`;
        break;

      case 'whatsapp':
        prompt += `## STEP ${stepNum}: ${data.label || 'Send on WhatsApp'} [Type: WhatsApp Message]\n`;
        prompt += `- ACTION: Ask whether the caller agrees to receive this on WhatsApp on this number. Only after a clear yes, call send_whatsapp with template "${routeKey(node.id)}" and consent_confirmed true. If they say no, continue without it.\n`;
        prompt += defaultNextTarget ? `- NEXT STEP: Proceed to ${getStepRef(defaultNextTarget)}.\n\n` : `\n`;
        break;

      case 'inCallSms':
        // Old SMS step (SMS never worked; replaced by WhatsApp). The AI must never promise a message.
        prompt += `## STEP ${stepNum}: ${data.label || 'Share details'} [Type: Share Details]\n`;
        prompt += `- ACTION: Do not promise to send any message. Offer to repeat the details slowly on the call instead.\n\n`;
        break;

      case 'extractVariable':
        prompt += `## STEP ${stepNum}: ${data.label || 'Extract Variable'} [Type: Variable Extraction]\n`;
        prompt += `- ACTION: Extract variable '${data.variableKey || data.variable || data.variableName || 'user_intent'}' from caller response.\n\n`;
        break;

      case 'code':
        prompt += `## STEP ${stepNum}: ${data.label || 'Execute Code'} [Type: Custom Code]\n`;
        prompt += `- ACTION: Execute inline code logic.\n\n`;
        break;

      case 'mcp':
        prompt += `## STEP ${stepNum}: ${data.label || 'MCP Integration'} [Type: Model Context Protocol]\n`;
        prompt += `- ACTION: Connect to MCP server endpoint (${data.mcpServer || 'local_mcp'}).\n\n`;
        break;

      case 'ending':
      case 'endCall':
        prompt += `## STEP ${stepNum}: ${data.label || 'Ending'} [Type: End Call]\n`;
        prompt += `- ACTION: Speak closing statement:\n  "${data.text || data.message || 'Thank you for calling. Have a great day!'}"\n`;
        prompt += `- TERMINATE: Gracefully end the call session.\n\n`;
        break;

      case 'checkCalendar':
        prompt += `## STEP ${stepNum}: ${data.label || 'Check Calendar'} [Type: Check Calendar]\n`;
        prompt += `- ACTION: Query availability and offer open slots to caller.\n\n`;
        break;

      default:
        prompt += `## STEP ${stepNum}: ${data.label || 'Step'}\n`;
        prompt += `- ACTION: ${data.text || 'Execute step logic.'}\n\n`;
        break;
    }
  });

  prompt += `# BEHAVIORAL CONSTRAINTS & VOICE QUALITY\n`;
  prompt += `1. Speak naturally with clear inflection and sub-200ms conversational timing.\n`;
  prompt += `2. Do not recite step names, node IDs, or technical structural headers to the caller.\n`;
  prompt += `3. Keep responses concise and focused on completing the step workflow.\n`;

  return prompt;
}

