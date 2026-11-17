/**
 * Shared client for one-shot text generation (Prompt Coach, Test Lab).
 *
 * - Timeouts on every request, one retry for temporary failures, then the next model in the list.
 * - The workspace's own Gemini key (bring-your-own-key) is used when saved; otherwise the platform key.
 * - The transport is swappable so tests run the real code path without calling the live API.
 *
 * Never log prompts or keys from here; log only model names, durations and error kinds.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { EncryptionService } from '../../utils/EncryptionService';

export interface TextGenerationRequest {
  model: string;
  apiKey: string;
  systemInstruction: string;
  prompt: string;
  temperature: number;
  maxOutputTokens: number;
  /** Ask the model for a JSON object. */
  json: boolean;
  timeoutMs: number;
}

export interface TextModelTransport {
  generate(request: TextGenerationRequest): Promise<string>;
}

/** Error kinds the routes turn into clear HTTP answers. */
export type TextModelErrorKind = 'not_configured' | 'timeout' | 'rate_limited' | 'unavailable' | 'blocked' | 'bad_output';

export class TextModelError extends Error {
  constructor(public readonly kind: TextModelErrorKind, message: string) {
    super(message);
    this.name = 'TextModelError';
  }
}

const geminiTransport: TextModelTransport = {
  async generate(req) {
    const client = new GoogleGenerativeAI(req.apiKey);
    const model = client.getGenerativeModel(
      {
        model: req.model,
        systemInstruction: req.systemInstruction,
        generationConfig: {
          temperature: req.temperature,
          maxOutputTokens: req.maxOutputTokens,
          ...(req.json ? { responseMimeType: 'application/json' } : {}),
        },
      },
      { timeout: req.timeoutMs },
    );
    const result = await model.generateContent(req.prompt);
    const blockReason = result.response.promptFeedback?.blockReason;
    if (blockReason) throw new TextModelError('blocked', `Request blocked by the model safety filter (${blockReason}).`);
    return result.response.text();
  },
};

let activeTransport: TextModelTransport = geminiTransport;

/** Tests only: replace the network transport. Pass null to restore the real one. */
export function setTextModelTransportForTests(transport: TextModelTransport | null): void {
  activeTransport = transport ?? geminiTransport;
}

/** Ordered model list: configured builder model first, then a stable fallback. */
export function textModelCandidates(): string[] {
  const primary = (process.env.GEMINI_BUILDER_MODEL || 'gemini-2.5-flash').trim();
  const fallback = 'gemini-2.0-flash';
  return primary === fallback ? [primary] : [primary, fallback];
}

/** The workspace's own Gemini key if saved, else the platform key, else null. */
export async function resolveTextModelApiKey(workspaceId: string): Promise<string | null> {
  try {
    const owner = await prisma.user.findUnique({ where: { id: workspaceId }, select: { geminiApiKey: true } });
    const own = EncryptionService.decryptIfEncrypted(owner?.geminiApiKey);
    if (own && own.trim()) return own.trim();
  } catch (e) {
    logger.warn('textModel: could not read workspace API key, using platform key', { error: String(e) });
  }
  const platform = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
  return platform && platform.trim() ? platform.trim() : null;
}

function classify(err: unknown): TextModelErrorKind {
  if (err instanceof TextModelError) return err.kind;
  const msg = String((err as any)?.message || err).toLowerCase();
  const status = Number((err as any)?.status || (err as any)?.statusCode || 0);
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted') || (err as any)?.name === 'AbortError') return 'timeout';
  if (status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('rate limit') || msg.includes('resource_exhausted')) return 'rate_limited';
  if (msg.includes('safety') || msg.includes('blocked')) return 'blocked';
  return 'unavailable';
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TextModelError('timeout', `Model did not answer within ${ms} ms.`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export interface GenerateTextOptions {
  workspaceId: string;
  systemInstruction: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  json?: boolean;
  /** Per attempt. */
  timeoutMs?: number;
  /** Label for logs, e.g. "prompt-coach". */
  purpose: string;
}

/**
 * Generates text. Tries each candidate model; a temporary failure (timeout, rate limit, outage)
 * is retried once on the same model before moving on. Safety blocks are not retried.
 */
export async function generateText(opts: GenerateTextOptions): Promise<{ text: string; model: string }> {
  const apiKey = await resolveTextModelApiKey(opts.workspaceId);
  if (!apiKey) throw new TextModelError('not_configured', 'No AI model key is configured.');

  let lastKind: TextModelErrorKind = 'unavailable';
  for (const model of textModelCandidates()) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const started = Date.now();
      const timeoutMs = opts.timeoutMs ?? 25_000;
      try {
        const text = await withTimeout(
          activeTransport.generate({
            model,
            apiKey,
            systemInstruction: opts.systemInstruction,
            prompt: opts.prompt,
            temperature: opts.temperature ?? 0.3,
            maxOutputTokens: opts.maxOutputTokens ?? 4096,
            json: opts.json ?? false,
            timeoutMs,
          }),
          timeoutMs + 1_000,
        );
        logger.info('textModel: generated', { purpose: opts.purpose, model, attempt, ms: Date.now() - started });
        return { text: String(text ?? ''), model };
      } catch (err) {
        lastKind = classify(err);
        logger.warn('textModel: attempt failed', { purpose: opts.purpose, model, attempt, kind: lastKind, ms: Date.now() - started });
        if (lastKind === 'blocked') throw new TextModelError('blocked', 'The AI model declined this request.');
        if (attempt === 1) await new Promise((r) => setTimeout(r, 400));
      }
    }
  }
  throw new TextModelError(lastKind, 'The AI model is temporarily unavailable.');
}
