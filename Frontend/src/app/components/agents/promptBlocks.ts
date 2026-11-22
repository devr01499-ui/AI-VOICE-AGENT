/**
 * The editor appends two generated blocks to an agent's saved prompt:
 *   [CALL DIRECTION INSTRUCTION]   one paragraph for inbound / outbound / both
 *   [AGENT HANDBOOK INSTRUCTIONS]  one "- ..." bullet per enabled handbook rule
 * They must come off again before the prompt is shown for editing or re-compiled.
 *
 * Audit fix (2026-11-22): the old cleanup was a regex that removed each block "up to the next
 * [HEADER] or the end of the text". The editor also showed the saved text, blocks included, so a
 * customer who typed new instructions at the end (after the handbook block) lost them silently on
 * the next save. This removes only the generated lines and keeps everything the customer wrote,
 * even text typed on the same line after a generated sentence.
 */

/** The generated direction paragraphs, one per direction (single line each). */
export const DIRECTION_TEXTS: Record<string, string> = {
  inbound: "This is an inbound call — the caller reached out to you. Never introduce an unprompted sales pitch or reason for calling, as the caller already has a reason for reaching out. Open by identifying the business/agent and inviting them to share what they need. Listen for and directly address what they say before offering anything else. If they seem to be waiting or the greeting overlaps with hold time, keep the opening brief and get to 'how can I help' quickly.",
  outbound: "This is an outbound call you are initiating. Keep your opening brief and state who's calling and why within the first two sentences (people who didn't request the call have short patience). If the person sounds uninterested, busy, or asks to not be called again, acknowledge respectfully and offer to end the call or follow up later rather than pushing to continue. Never claim the person asked for this call. If asked 'how did you get my number', give an honest, direct answer if your context/prompt provides one, otherwise say a team member can follow up with that detail. Keep pitching proportionate — one clear value statement, not repeated re-pitching if the person has already responded neutrally or negatively.",
  both: "This agent handles both inbound and outbound calls. Rely on the agent's prompt and let context (how the call started) guide tone naturally without forced direction framing.",
};

export const DIRECTION_HEADER = '[CALL DIRECTION INSTRUCTION]';
export const HANDBOOK_HEADER = '[AGENT HANDBOOK INSTRUCTIONS]';

/**
 * Removes the generated direction and handbook blocks and returns only the customer's own text.
 * `knownBullets` are the handbook rule texts: a customer's words typed after one of them on the
 * same line are kept. Other bullet lines directly under the handbook header are generated
 * (for example older rule wording) and are dropped.
 */
export function stripGeneratedPromptBlocks(text: string | null | undefined, knownBullets: string[] = []): string {
  const directionTexts = Object.values(DIRECTION_TEXTS);
  const out: string[] = [];
  let mode: 'none' | 'direction' | 'handbook' = 'none';
  for (const line of String(text || '').split('\n')) {
    const trimmed = line.trim();
    if (trimmed === DIRECTION_HEADER) { mode = 'direction'; continue; }
    if (trimmed === HANDBOOK_HEADER) { mode = 'handbook'; continue; }
    if (mode === 'direction') {
      if (trimmed === '') continue;
      const known = directionTexts.find((t) => trimmed.startsWith(t));
      const rest = known ? trimmed.slice(known.length).trim() : '';
      if (rest) out.push(rest);
      mode = 'none'; // the generated paragraph is always a single line
      continue;
    }
    if (mode === 'handbook') {
      if (trimmed.startsWith('- ')) {
        const known = knownBullets.find((b) => trimmed.startsWith(`- ${b}`));
        const rest = known ? trimmed.slice(2 + known.length).trim() : '';
        if (rest) out.push(rest);
        continue;
      }
      if (trimmed === '') { mode = 'none'; continue; }
      mode = 'none'; // first non-bullet line: the customer's own text again
    }
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
