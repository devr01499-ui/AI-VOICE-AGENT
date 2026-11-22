/**
 * Authoritative Single Source of Truth for Telephony Capabilities
 * 
 * Defines active system capabilities and generates the boundary directives
 * appended to every agent's system prompt to permanently prevent the AI
 * from promising SMS, WhatsApp, email, links, or payments.
 */

export interface TelephonyCapabilities {
  hangup: boolean;
  endCall: boolean;
  sms: boolean;
  whatsapp: boolean;
  email: boolean;
  payments: boolean;
  transfer: boolean;
  /** Only when transfer is true: false when only AI-specialist hand-offs are configured. */
  transferToHuman?: boolean;
  dtmf: boolean;
}

export const TELEPHONY_CAPABILITIES: TelephonyCapabilities = {
  hangup: true,
  endCall: true,
  sms: false,
  whatsapp: false,
  email: false,
  payments: false,
  transfer: false,
  dtmf: false,
};

/**
 * Generates an authoritative boundary block explaining exactly what the agent
 * can and cannot do on the live voice call.
 */
export function buildCapabilitiesBlock(caps: TelephonyCapabilities = TELEPHONY_CAPABILITIES): string {
  const disallowed: string[] = [];
  if (!caps.sms) disallowed.push('SMS or text messages');
  if (!caps.whatsapp) disallowed.push('WhatsApp messages');
  if (!caps.email) disallowed.push('emails');
  if (!caps.payments) disallowed.push('payment links or payments');
  if (!caps.transfer) disallowed.push('call transfers to other numbers/agents');
  else if (!caps.transferToHuman) disallowed.push('call transfers to phone numbers');

  if (caps.whatsapp) {
    // WhatsApp is configured on this call (approved templates only, after the caller agrees).
    return `
[CAPABILITIES & COMMUNICATION BOUNDARIES]
- Channels: you speak on this live call, and you can send ONLY the approved WhatsApp messages listed under [WHATSAPP], with the send_whatsapp tool, after the caller agrees.
- Strictly Disallowed: You do NOT have the technical capability to send ${disallowed.join(', ')}.
- Forbidden Promises: never promise SMS, email, links or payments, and never say a WhatsApp message was sent unless send_whatsapp confirmed it.
- If the caller wants something you cannot send: repeat or spell out the details slowly now, or note a callback request for the team.
`.trim();
  }
  return `
[CAPABILITIES & COMMUNICATION BOUNDARIES]
- Voice-Only Channel: You can only speak and listen on this live audio call.
- Strictly Disallowed: You do NOT have the technical capability to send ${disallowed.join(', ')}.
- Forbidden Promises: If the caller asks you to send them details via WhatsApp, SMS, email, text message, link, or payment, you must NEVER promise or say that you will send it (e.g., never say "I will text you that" or "I've sent it to your WhatsApp").
- Handling Requests: State clearly and politely that you cannot send messages from this call. Instead, offer what you CAN do:
  1. Repeat or spell out the details slowly right now on the line.
  2. Note down a callback request for our team to follow up with them later.
`.trim();
}

/**
 * Filter tools array to only include tools whose capabilities are active.
 */
export function filterActiveTools(tools: any[], caps: TelephonyCapabilities = TELEPHONY_CAPABILITIES): any[] {
  if (!Array.isArray(tools)) return [];
  const disallowedToolNames = new Set<string>();
  // SMS was never available and is replaced by WhatsApp (send_whatsapp).
  disallowedToolNames.add('send_sms');
  if (!caps.whatsapp) disallowedToolNames.add('send_whatsapp');
  if (!caps.transfer) {
    disallowedToolNames.add('transfer_call');
    disallowedToolNames.add('agent_transfer');
  }
  if (!caps.dtmf) disallowedToolNames.add('press_digit');

  return tools.filter(t => {
    const name = (t.name || '').toLowerCase();
    if (disallowedToolNames.has(name)) return false;
    if (name.startsWith('code_')) return false; // remove unsupported sandbox code execution tools
    return true;
  });
}
