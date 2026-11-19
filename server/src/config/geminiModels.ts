/**
 * Gemini model IDs — the one place they are decided (owner instruction 2026-11-19: use the newest
 * models Google offers and drop the ones Google has removed).
 *
 * Source: Google's official model and deprecation pages (aistudio.google.com/docs/models and
 * /docs/deprecations, checked 2026-11-19). Re-check those pages before changing anything here.
 *
 * Voice (Live API):
 *  - gemini-3.8-live                               GA 2026-09-15, no shutdown date. Primary.
 *  - gemini-2.5-flash-native-audio-preview-12-2025 earliest shutdown 2027-03-31. Fallback only,
 *    used when the primary refuses the session; every use is logged as [LIVE_MODEL_FALLBACK].
 *  Removed by Google (calls with these fail): gemini-2.0-flash-exp, gemini-2.0-flash-live-001,
 *  gemini-live-2.5-flash-preview, gemini-2.5-flash-preview-native-audio-dialog,
 *  gemini-2.5-flash-exp-native-audio-thinking-dialog. Superseded / undocumented:
 *  gemini-2.5-flash-native-audio-preview-09-2025, gemini-2.5-flash-native-audio-latest,
 *  gemini-3.1-flash-live-preview (Google: "move to gemini-3.8-live").
 *
 * Text (prompt coach, test lab, call analysis, chat preview):
 *  - gemini-3.6-flash (stable; Google's listed replacement for gemini-2.0-flash), then
 *    gemini-3.5-flash-lite (stable). gemini-2.0-flash was shut down 2026-06-01; gemini-2.5-flash
 *    is deprecated and routes to gemini-3.5-flash-lite from 2026-12-01.
 */

export const LIVE_MODEL_PRIMARY = 'gemini-3.8-live';
export const LIVE_MODEL_FALLBACK = 'gemini-2.5-flash-native-audio-preview-12-2025';

/** Live models an agent may run on. Anything else stored on an agent resolves to the primary. */
export const SUPPORTED_LIVE_MODELS: readonly string[] = [
  LIVE_MODEL_PRIMARY,
  'gemini-3.8-live-extended-thinking',
  LIVE_MODEL_FALLBACK,
];

export const RETIRED_LIVE_MODELS: readonly string[] = [
  'gemini-2.0-flash-exp',
  'gemini-2.0-flash-live-001',
  'gemini-live-2.5-flash-preview',
  'gemini-2.5-flash-preview-native-audio-dialog',
  'gemini-2.5-flash-exp-native-audio-thinking-dialog',
  'gemini-2.5-flash-native-audio-preview-09-2025',
  'gemini-2.5-flash-native-audio-latest',
  'gemini-3.1-flash-live-preview',
];

export const TEXT_MODEL_PRIMARY = 'gemini-3.6-flash';
export const TEXT_MODEL_FALLBACK = 'gemini-3.5-flash-lite';

export const RETIRED_TEXT_MODELS: readonly string[] = [
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash-lite-001',
  'gemini-2.0-flash-exp',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];

const bare = (id: string) => String(id || '').trim().replace(/^models\//, '');

/** True for the Gemini 3.8 Live family (setup differs from the 2.5 native-audio models). */
export function isGemini38Live(model: string): boolean {
  return bare(model).startsWith('gemini-3.8-live');
}

/**
 * A text model from configuration (env), unless it is one Google has removed or deprecated;
 * then the current default, so a stale Render variable cannot break the feature.
 */
export function configuredTextModel(value: string | undefined | null): string {
  const id = bare(value || '');
  if (!id || RETIRED_TEXT_MODELS.includes(id) || id.includes('native-audio') || id.includes('-live')) return TEXT_MODEL_PRIMARY;
  return id;
}

/** Ordered text models to try: the configured one (if still offered), then a stable fallback. */
export function textModelCandidates(value?: string | null): string[] {
  const primary = configuredTextModel(value);
  return primary === TEXT_MODEL_FALLBACK ? [primary] : [primary, TEXT_MODEL_FALLBACK];
}
