/**
 * resolveLiveModel — single source of truth for the Gemini Live model a call uses.
 *
 * An agent's stored model is used only when it is a Live model Google still offers
 * (SUPPORTED_LIVE_MODELS in config/geminiModels.ts). Everything else — empty, a text model
 * ("gemini-2.5-flash"), another vendor's name, or a Live model Google has removed
 * ("gemini-2.0-flash-exp", "gemini-2.5-flash-native-audio-latest", ...) — resolves to the current
 * primary model, so agents saved earlier keep working without a data migration.
 * The result always carries the "models/" prefix the Live API setup message expects.
 */
import { LIVE_MODEL_FALLBACK, LIVE_MODEL_PRIMARY, SUPPORTED_LIVE_MODELS } from '../config/geminiModels';

export const DEFAULT_LIVE_MODEL = `models/${LIVE_MODEL_PRIMARY}`;
/** Used once when the primary model refuses the session (logged as [LIVE_MODEL_FALLBACK]). */
export const UNIVERSAL_FALLBACK_LIVE_MODEL = `models/${LIVE_MODEL_FALLBACK}`;

export function resolveLiveModel(value: string | null | undefined): string {
  if (!value || typeof value !== 'string') return DEFAULT_LIVE_MODEL;
  const id = value.trim().replace(/^models\//, '');
  if (SUPPORTED_LIVE_MODELS.includes(id)) return `models/${id}`;
  return DEFAULT_LIVE_MODEL;
}
