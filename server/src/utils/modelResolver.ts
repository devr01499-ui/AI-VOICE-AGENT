/**
 * resolveLiveModel — single source of truth for Gemini Live model name normalisation.
 *
 * Rules (in priority order):
 * 1. If the value contains "native-audio", use it — but add a "models/" prefix when
 *    it is missing (e.g. "gemini-2.5-flash-native-audio-latest" → OK,
 *    "models/gemini-2.5-flash-native-audio-latest" → kept as-is).
 * 2. Everything else (empty, null, undefined, "gemini-2.5-flash", "gpt-4o", …)
 *    falls through to the safe default Live audio model.
 *
 * This ensures that agents saved before the model-name fix was deployed still work
 * without a data migration.
 */

export const DEFAULT_LIVE_MODEL = 'models/gemini-2.5-flash-native-audio-latest';

export function resolveLiveModel(value: string | null | undefined): string {
  if (!value || typeof value !== 'string') return DEFAULT_LIVE_MODEL;

  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_LIVE_MODEL;

  // If the value contains "native-audio" it's a valid Live model name
  if (trimmed.includes('native-audio')) {
    return trimmed.startsWith('models/') ? trimmed : `models/${trimmed}`;
  }

  // Anything else (text models, empty strings, wrong model names, etc.)
  return DEFAULT_LIVE_MODEL;
}
