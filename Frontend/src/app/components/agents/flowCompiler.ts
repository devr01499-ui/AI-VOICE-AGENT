export interface FlowNodeData {
  label: string;
  text?: string;
  question?: string;
  prompt?: string;
  variable?: string;
  variableName?: string;
  instructions?: string;
  branches?: Array<{ condition: string; targetNodeId: string }>;
  targetNumber?: string;
  toolName?: string;
  digits?: string;
  smsMessage?: string;
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

/**
 * Compiles a visual FlowGraph JSON into a structured, executable system prompt for Gemini Live engine.
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

  flow.nodes.forEach((node, index) => {
    const stepNum = index + 1;
    const data = node.data;

    switch (node.type) {
      case 'start':
      case 'conversation':
      case 'sayMessage':
        prompt += `## STEP ${stepNum}: ${data.label || 'Conversation'} [Type: Say Message]\n`;
        prompt += `- ACTION: Speak the following message:\n  "${data.text || data.message || 'Hello! How can I assist you today?'}"\n`;
        prompt += `- NEXT STEP: Proceed to the connected node in sequence.\n\n`;
        break;

      case 'askQuestion':
      case 'collectInput':
        prompt += `## STEP ${stepNum}: ${data.label || 'Collect Input'} [Type: Ask Question / Collect Input]\n`;
        prompt += `- ACTION: Ask the caller:\n  "${data.question || data.prompt || data.text || ''}"\n`;
        if (data.variable || data.variableName) {
          prompt += `- VARIABLE: Store answer as '${data.variable || data.variableName}'\n`;
        }
        prompt += `- WAIT: Listen to response, record intent/variables, and proceed.\n\n`;
        break;


      case 'subagent':
      case 'agentTransfer':
        prompt += `## STEP ${stepNum}: ${data.label || 'Subagent Transfer'} [Type: Agent Transfer]\n`;
        prompt += `- ACTION: Hand off conversational context to subagent (${data.subagentName || data.label}).\n\n`;
        break;

      case 'function':
      case 'callTool':
        prompt += `## STEP ${stepNum}: ${data.label || 'Execute Tool'} [Type: Function Call]\n`;
        prompt += `- ACTION: Execute dynamic tool operation (${data.toolName || 'webhook_handler'}).\n\n`;
        break;

      case 'transferCall':
        prompt += `## STEP ${stepNum}: ${data.label || 'Transfer Call'} [Type: Call Transfer]\n`;
        prompt += `- ACTION: Inform the caller and initiate call transfer to ${data.targetNumber || 'operator'}.\n\n`;
        break;

      case 'pressDigit':
        prompt += `## STEP ${stepNum}: ${data.label || 'Press Digit'} [Type: DTMF Keypad]\n`;
        prompt += `- ACTION: Play IVR key tone or capture keypad digits (${data.digits || '1'}).\n\n`;
        break;

      case 'logicSplit':
      case 'conditionBranch':
        prompt += `## STEP ${stepNum}: ${data.label || 'Logic Split'} [Type: Condition Branch]\n`;
        prompt += `- ACTION: Evaluate caller response against branching criteria:\n`;
        if (data.branches && data.branches.length > 0) {
          data.branches.forEach((b, bIdx) => {
            prompt += `  * BRANCH ${String.fromCharCode(65 + bIdx)} (If ${b.condition}): Proceed to node ${b.targetNodeId}.\n`;
          });
        } else {
          prompt += `  * Evaluate intent and transition to the appropriate branch.\n`;
        }
        prompt += `\n`;
        break;

      case 'inCallSms':
        prompt += `## STEP ${stepNum}: ${data.label || 'In-Call SMS'} [Type: Send SMS]\n`;
        prompt += `- ACTION: Dispatch text message to caller's mobile number: "${data.smsMessage || 'Your confirmation link has been sent.'}"\n\n`;
        break;

      case 'extractVariable':
        prompt += `## STEP ${stepNum}: ${data.label || 'Extract Variable'} [Type: Variable Extraction]\n`;
        prompt += `- ACTION: Extract variable '${data.variable || 'user_intent'}' from caller response.\n\n`;
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

      case 'note':
        // Notes are design annotations, omitted from live LLM execution prompt
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
