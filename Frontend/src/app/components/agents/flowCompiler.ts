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
export function compileFlowToSystemPrompt(flow: FlowGraph, agentName: string = "AI Voice Agent"): string {
  if (!flow || !flow.nodes || flow.nodes.length === 0) {
    return `You are ${agentName}, a professional AI voice agent for Claritiy Voice. Answer user queries concisely and professionally.`;
  }

  let prompt = `# AGENT IDENTITY & ROLE\n`;
  prompt += `You are an autonomous AI voice agent (${agentName}) for Claritiy Voice operating under a visual multi-step conversational flow graph.\n\n`;
  prompt += `# CONVERSATIONAL EXECUTION INSTRUCTIONS\n`;
  prompt += `You MUST strictly execute the following step-by-step dialogue flow. Guide the caller through each step in sequence and evaluate branching conditions based on user responses.\n\n`;

  flow.nodes.forEach((node, index) => {
    const stepNum = index + 1;
    const data = node.data;

    switch (node.type) {
      case 'conversation':
      case 'sayMessage':
        prompt += `## STEP ${stepNum}: ${data.label || 'Conversation'} [Type: Say Message]\n`;
        prompt += `- ACTION: Speak the following message:\n  "${data.text || 'Hello! How can I assist you today?'}"\n`;
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
        prompt += `- ACTION: Speak closing statement:\n  "${data.text || 'Thank you for calling. Have a great day!'}"\n`;
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
