/**
 * Voice Persona, Accent & Pronunciation Directives
 * Version: 1.0.0
 * 
 * Centralized, versioned, admin-editable pronunciation directives for Gemini Native-Audio.
 * Steers Indian-English / Hinglish register, grouped number delivery, natural cadence,
 * and conversational pacing without inventing unsupported model parameters.
 */

export const VOICE_PERSONA_VERSION = '1.0.0';

export type ResponseStyle = 'concise' | 'balanced' | 'consultative';

export const INDIAN_ENGLISH_PRONUNCIATION_DIRECTIVE = `
[PERSONA & PRONUNCIATION GUIDELINES (v${VOICE_PERSONA_VERSION})]
- Register & Tone: Speak in a warm, polite, and confident Indian-English or Hinglish register tailored to business telephone calls.
- Pace & Cadence: Maintain an even, conversational pace. Deliver concise responses (1 to 2 sentences per conversational turn). Never monologue.
- Spoken Numbers & Digits: When speaking phone numbers, reference IDs, OTPs, or currency amounts, group digits with natural micro-pauses (e.g., "9 8 7 6 5, 4 3 2 1 0" or "twelve thousand five hundred rupees") rather than reading continuous unbroken digits.
- Conversational Fillers: Use brief acknowledgments sparingly (e.g., "Sure", "Right", "Got it", "Certainly") to signal active listening, without repetitive overuse.
- Anti-Robotic Delivery: Never recite bullet points, numbered lists, asterisks, or markdown symbols. Speak fluidly as an attentive human professional.
`.trim();

/**
 * Returns role-aware pronunciation and cadence directive according to the selected response style.
 */
export function getPersonaDirectiveForStyle(style: ResponseStyle = 'concise'): string {
  let paceDirective = 'Deliver concise responses (1 to 2 sentences per conversational turn). Never monologue.';
  if (style === 'balanced') {
    paceDirective = 'Deliver clear, balanced responses (2 to 3 sentences per conversational turn). Never monologue.';
  } else if (style === 'consultative') {
    paceDirective = 'Deliver consultative, structured responses (3 to 4 well-paced sentences). Offer reasoned guidance, contextual explanations, and thoughtful follow-up questions tailored to sales and advisory consultations. Never monologue.';
  }

  return `
[PERSONA & PRONUNCIATION GUIDELINES (v${VOICE_PERSONA_VERSION})]
- Register & Tone: Speak in a warm, polite, and confident Indian-English or Hinglish register tailored to business telephone calls.
- Pace & Cadence: Maintain an even, conversational pace. ${paceDirective}
- Spoken Numbers & Digits: When speaking phone numbers, reference IDs, OTPs, or currency amounts, group digits with natural micro-pauses (e.g., "9 8 7 6 5, 4 3 2 1 0" or "twelve thousand five hundred rupees") rather than reading continuous unbroken digits.
- Conversational Fillers: Use brief acknowledgments sparingly (e.g., "Sure", "Right", "Got it", "Certainly") to signal active listening, without repetitive overuse.
- Anti-Robotic Delivery: Never recite bullet points, numbered lists, asterisks, or markdown symbols. Speak fluidly as an attentive human professional.
`.trim();
}

/**
 * Top recommended prebuilt voices tested and curated per language.
 */
export const RECOMMENDED_VOICES_BY_LANGUAGE: Record<string, { male: string[]; female: string[] }> = {
  en: {
    male: ['Puck', 'Charon', 'Fenrir'],
    female: ['Kore', 'Aoede', 'Zephyr'],
  },
  hi: {
    male: ['Puck', 'Charon'],
    female: ['Kore', 'Aoede'],
  },
  bn: {
    male: ['Puck'],
    female: ['Kore', 'Aoede'],
  },
  kn: {
    male: ['Puck'],
    female: ['Kore'],
  },
  ml: {
    male: ['Puck'],
    female: ['Kore'],
  },
  gu: {
    male: ['Puck'],
    female: ['Kore'],
  },
  ta: {
    male: ['Puck'],
    female: ['Kore'],
  },
  zh: {
    male: ['Puck', 'Charon'],
    female: ['Kore', 'Aoede'],
  },
  ar: {
    male: ['Puck', 'Charon'],
    female: ['Kore', 'Aoede'],
  },
};

/**
 * Injects the persona & pronunciation directive into an existing system instruction string.
 * Supports role-aware response style (concise | balanced | consultative).
 */
export function injectVoicePersonaDirective(existingPrompt: string, style?: ResponseStyle): string {
  const directive = style ? getPersonaDirectiveForStyle(style) : INDIAN_ENGLISH_PRONUNCIATION_DIRECTIVE;
  if (!existingPrompt) {
    return directive;
  }
  if (existingPrompt.includes('[PERSONA & PRONUNCIATION GUIDELINES')) {
    return existingPrompt; // Idempotent injection
  }
  return `${existingPrompt.trim()}\n\n${directive}`;
}
