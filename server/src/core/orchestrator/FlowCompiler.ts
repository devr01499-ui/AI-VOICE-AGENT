/**
 * Flow Compiler
 *
 * Compiles a visual node/transition graph into a master system prompt
 * for LLM execution, enabling tool call triggers for active nodes.
 */

export interface FlowNode {
  id: string;
  type: string;
  data?: {
    text?: string;
    message?: string;
    phoneNumber?: string;
    [key: string]: any;
  };
  transitions?: Array<{
    condition: string;
    targetId: string;
  }>;
}

export function compileFlowToPrompt(agentName: string, nodes: FlowNode[]): string {
  let prompt = `You are ${agentName}, an advanced Conversational Voice AI agent executing a state machine graph flow.

RULES:
1. You must track your active node location in the state machine.
2. The user will speak. You must listen, respond, and evaluate if their response matches any transitions from your current node.
3. If a transition condition matches, change your current node and speak the output message of that new node.
4. If a node requires tool execution (e.g. End Call, Call Transfer, In-Call SMS), execute that tool immediately.

CURRENT GRAPH STATE MACHINE DETAILS:
`;

  const welcomeNode = nodes.find(n => n.type === 'conversation' || n.id.includes('welcome'));
  const beginMessage = welcomeNode?.data?.text || welcomeNode?.data?.message || 'Hello! How can I help you today?';

  for (const node of nodes) {
    const nodeText = node.data?.text || node.data?.message || '';
    prompt += `\n- NODE [${node.id}] (${node.type})
  Prompt/Message: "${nodeText}"`;
    
    if (node.transitions && node.transitions.length > 0) {
      prompt += `\n  Transitions:`;
      for (const t of node.transitions) {
        prompt += `\n    * If user intent matches: "${t.condition}" -> Go to Node [${t.targetId}]`;
      }
    }
  }

  prompt += `\n\nTOOL EXECUTION PROTOCOLS:
- If you transition to a node of type "ending", you must call the tool "hang_up()".
- If you transition to a node of type "call_transfer", you must call the tool "transfer_call(phoneNumber: "...")" with the target number.
- If you transition to a node of type "in_call_sms", you must call the tool "send_sms(phoneNumber: "...", message: "...")".

Begin at the Welcome Node. Speak this greeting: "${beginMessage}"`;

  return prompt;
}

export function compile(flowGraph: string, agentName: string = 'Clarity AI'): string {
  if (!flowGraph || flowGraph === "" || flowGraph === "{}") {
    return "You are a professional corporate assistant for Clarity.";
  }
  const parsed = JSON.parse(flowGraph);
  if (!parsed || !Array.isArray(parsed.nodes)) {
    return "You are a professional corporate assistant for Clarity.";
  }
  return compileFlowToPrompt(agentName, parsed.nodes);
}
