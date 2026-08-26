export interface FlowNodeData {
  label: string;
  text?: string;
  question?: string;
  variable?: string;
  branches?: Array<{ condition: string; targetNodeId: string }>;
  targetNumber?: string;
  toolName?: string;
}

export interface FlowNode {
  id: string;
  type: 'sayMessage' | 'askQuestion' | 'conditionBranch' | 'transferCall' | 'endCall' | 'callTool' | 'checkCalendar';
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
    return `You are ${agentName}, a professional AI voice agent. Answer user queries concisely and professionally.`;
  }

  let prompt = `# AGENT IDENTITY & ROLE\n`;
  prompt += `You are an autonomous AI voice agent (${agentName}) for Claritiy Voice operating under a visual multi-step conversational flow graph.\n\n`;
  prompt += `# CONVERSATIONAL EXECUTION INSTRUCTIONS\n`;
  prompt += `You MUST strictly execute the following step-by-step dialogue flow. Guide the caller through each step in sequence and evaluate branching conditions based on user responses.\n\n`;

  flow.nodes.forEach((node, index) => {
    const stepNum = index + 1;
    const data = node.data;

    switch (node.type) {
      case 'sayMessage':
        prompt += `## STEP ${stepNum}: ${data.label || 'Message'} [Type: Say Message]\n`;
        prompt += `- ACTION: Speak the following message:\n  "${data.text || ''}"\n`;
        prompt += `- NEXT STEP: Proceed to the connected node in the sequence.\n\n`;
        break;

      case 'askQuestion':
        prompt += `## STEP ${stepNum}: ${data.label || 'Collect Input'} [Type: Ask Question]\n`;
        prompt += `- ACTION: Ask the caller:\n  "${data.question || data.text || ''}"\n`;
        prompt += `- WAIT: Listen to response, record intent/variables, and proceed.\n\n`;
        break;

      case 'conditionBranch':
        prompt += `## STEP ${stepNum}: ${data.label || 'Branch Condition'} [Type: Condition Branch]\n`;
        prompt += `- ACTION: Evaluate caller response against the following branching criteria:\n`;
        if (data.branches && data.branches.length > 0) {
          data.branches.forEach((b, bIdx) => {
            prompt += `  * BRANCH ${String.fromCharCode(65 + bIdx)} (If ${b.condition}): Proceed to node ${b.targetNodeId}.\n`;
          });
        } else {
          prompt += `  * Evaluate intent and transition to the appropriate branch.\n`;
        }
        prompt += `\n`;
        break;

      case 'transferCall':
        prompt += `## STEP ${stepNum}: ${data.label || 'Transfer Call'} [Type: Transfer Call]\n`;
        prompt += `- ACTION: Inform the caller and initiate transfer to ${data.targetNumber || 'support'}.\n\n`;
        break;

      case 'endCall':
        prompt += `## STEP ${stepNum}: ${data.label || 'End Call'} [Type: End Call]\n`;
        prompt += `- ACTION: Speak closing message:\n  "${data.text || 'Thank you for calling. Have a great day!'}"\n`;
        prompt += `- TERMINATE: Gracefully end the call session.\n\n`;
        break;

      case 'checkCalendar':
        prompt += `## STEP ${stepNum}: ${data.label || 'Check Calendar'} [Type: Check Calendar]\n`;
        prompt += `- ACTION: Query availability and offer open slots to caller.\n\n`;
        break;

      case 'callTool':
        prompt += `## STEP ${stepNum}: ${data.label || 'Execute Tool'} [Type: Call Tool]\n`;
        prompt += `- ACTION: Execute dynamic tool operation (${data.toolName || 'webhook'}).\n\n`;
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
