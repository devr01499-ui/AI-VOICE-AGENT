import { logger } from './logger';

export type EmbeddingTaskType = 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' | 'SEMANTIC_SIMILARITY';

// ─── LRU Embedding Cache ─────────────────────────────────────────────
interface CacheEntry {
  vector: number[];
  cachedAt: number;
}

const MAX_CACHE_SIZE = 2000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const embeddingCache = new Map<string, CacheEntry>();

let cacheHits = 0;
let cacheMisses = 0;

export function getEmbeddingCacheStats() {
  return {
    size: embeddingCache.size,
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: cacheHits + cacheMisses > 0 ? (cacheHits / (cacheHits + cacheMisses)).toFixed(3) : '0.000',
  };
}

export function clearEmbeddingCache(): void {
  embeddingCache.clear();
  cacheHits = 0;
  cacheMisses = 0;
}

/**
 * Deterministic pseudo-vector generator for test/offline environments when no external API key is present.
 * Ensures tests can run without failure or network dependencies.
 */
function generateDeterministicFallbackVector(text: string, dimensions = 3072): number[] {
  const vector: number[] = new Array(dimensions).fill(0);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  let magSq = 0;
  for (let d = 0; d < dimensions; d++) {
    const val = Math.sin(hash + d * 0.1);
    vector[d] = val;
    magSq += val * val;
  }
  const mag = Math.sqrt(magSq) || 1;
  return vector.map(v => Number((v / mag).toFixed(6)));
}

/**
 * Single text embedding with retry, exponential backoff, and task-type awareness.
 */
export async function getEmbedding(
  text: string,
  taskType: EmbeddingTaskType = 'RETRIEVAL_QUERY',
  title?: string
): Promise<number[]> {
  const normalized = `${taskType}:${text.trim().toLowerCase()}`;

  // 1. Check in-memory LRU cache
  const cached = embeddingCache.get(normalized);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    cacheHits++;
    return cached.vector;
  }

  cacheMisses++;

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    logger.warn('getEmbedding: No GEMINI_API_KEY configured, utilizing deterministic fallback vector');
    const fallbackVec = generateDeterministicFallbackVector(text);
    embeddingCache.set(normalized, { vector: fallbackVec, cachedAt: Date.now() });
    return fallbackVec;
  }

  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-embedding-2:embedContent?key=${apiKey}`;

  const payload: any = {
    model: 'models/gemini-embedding-2',
    content: {
      parts: [{ text }],
    },
    taskType,
  };

  if (title && taskType === 'RETRIEVAL_DOCUMENT') {
    payload.title = title;
  }

  // Retries with exponential backoff
  let attempt = 0;
  const maxAttempts = 3;
  let delay = 300;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 429 || response.status >= 500) {
          if (attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, delay));
            delay *= 2;
            continue;
          }
        }
        throw new Error(`Google Embedding API error (status ${response.status}): ${errText}`);
      }

      const data = (await response.json()) as any;
      const values = data.embedding?.values;
      if (!values || !Array.isArray(values)) {
        throw new Error('Google Embedding API returned an empty or malformed embedding vector');
      }

      // Evict if cache exceeds max size
      if (embeddingCache.size >= MAX_CACHE_SIZE) {
        const firstKey = embeddingCache.keys().next().value;
        if (firstKey) {
          embeddingCache.delete(firstKey);
        }
      }

      embeddingCache.set(normalized, {
        vector: values,
        cachedAt: Date.now(),
      });

      return values;
    } catch (err: any) {
      if (attempt >= maxAttempts) {
        logger.error('getEmbedding: failed after max retries', { error: err.message, textSample: text.slice(0, 50) });
        throw err;
      }
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }

  throw new Error('getEmbedding: failed to generate embedding vector');
}

/**
 * Batch embedder with concurrency throttle and progress callback.
 */
export async function getEmbeddingsBatch(
  items: { text: string; title?: string }[],
  taskType: EmbeddingTaskType = 'RETRIEVAL_DOCUMENT',
  concurrency = 5,
  onProgress?: (completed: number, total: number) => void
): Promise<number[][]> {
  const results: number[][] = new Array(items.length);
  let completed = 0;

  const queue = items.map((item, index) => ({ ...item, index }));

  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) break;

      const vec = await getEmbedding(task.text, taskType, task.title);
      results[task.index] = vec;
      completed++;
      if (onProgress) {
        onProgress(completed, items.length);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);

  return results;
}
