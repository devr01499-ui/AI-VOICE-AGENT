/**
 * promptOptimizer.ts
 * Claritiy Voice System Utility
 * 
 * Deduplicates and sanitizes system prompts to minimize prompt compilation
 * latency and token overhead on real-time bidirectional WebSocket sessions.
 */

export function deduplicateSystemPrompt(rawPrompt: string): string {
  if (!rawPrompt || typeof rawPrompt !== 'string') {
    return rawPrompt || '';
  }

  let prompt = rawPrompt.trim();

  // 1. Detect if entire multi-step flow graph was duplicated repeatedly
  // Frontend VisualFlowCanvas historically concatenated the entire flow on top of previous saves.
  const identityMarker = '# AGENT IDENTITY & ROLE';
  const firstIdentityIdx = prompt.indexOf(identityMarker);
  if (firstIdentityIdx !== -1) {
    const secondIdentityIdx = prompt.indexOf(identityMarker, firstIdentityIdx + identityMarker.length);
    if (secondIdentityIdx !== -1) {
      // Keep everything up to the second occurrence of the full graph
      prompt = prompt.slice(0, secondIdentityIdx).trim();
    }
  }

  // 2. Remove duplicate [CALL DIRECTION INSTRUCTION] blocks
  const directionMarker = '[CALL DIRECTION INSTRUCTION]';
  const directionParts = prompt.split(directionMarker);
  if (directionParts.length > 2) {
    // Keep only the first block after directionMarker until next section or double newline
    const firstPart = directionParts[0];
    const secondPart = directionParts[1];
    // Find where the direction text ends (usually next bracketed section like [AGENT HANDBOOK] or end)
    const nextSectionIdx = secondPart.search(/\n\n\[/);
    let directionContent = '';
    let remainder = '';
    if (nextSectionIdx !== -1) {
      directionContent = secondPart.slice(0, nextSectionIdx).trim();
      remainder = secondPart.slice(nextSectionIdx).trim();
    } else {
      directionContent = secondPart.trim();
    }
    prompt = `${firstPart.trim()}\n\n${directionMarker}\n${directionContent}\n\n${remainder}`.trim();
  }

  // 3. Remove duplicate [AGENT HANDBOOK INSTRUCTIONS] blocks
  const handbookMarker = '[AGENT HANDBOOK INSTRUCTIONS]';
  const handbookParts = prompt.split(handbookMarker);
  if (handbookParts.length > 2) {
    // Combine unique handbook bullet items
    const allBullets = new Set<string>();
    for (let i = 1; i < handbookParts.length; i++) {
      const lines = handbookParts[i].split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          allBullets.add(trimmed);
        } else if (trimmed.startsWith('[')) {
          // Reached next section
          break;
        }
      }
    }
    const bulletsText = Array.from(allBullets).join('\n');
    prompt = `${handbookParts[0].trim()}\n\n${handbookMarker}\n${bulletsText}`.trim();
  }

  return prompt;
}
