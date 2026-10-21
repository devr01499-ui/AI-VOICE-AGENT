import { logger } from './logger';

// ─── LRU Embedding Cache ─────────────────────────────────────────────
interface CacheEntry {
  vector: number[];
  cachedAt: number;
}

const MAX_CACHE_SIZE = 1000;
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

export async function getEmbedding(text: string): Promise<number[]> {
  const normalized = text.trim().toLowerCase();

  // 1. Check in-memory cache
  const cached = embeddingCache.get(normalized);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    cacheHits++;
    logger.debug('getEmbedding: cache hit', { query: normalized, cacheHits });
    return cached.vector;
  }

  cacheMisses++;

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY / GOOGLE_API_KEY environment variable');
  }

  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-embedding-2:embedContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'models/gemini-embedding-2',
        content: {
          parts: [{ text }],
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Embedding API error (status ${response.status}): ${errText}`);
    }

    const data = (await response.json()) as any;
    const values = data.embedding?.values;
    if (!values || !Array.isArray(values)) {
      throw new Error('Google Embedding API returned an empty or malformed embedding vector');
    }

    // 2. Store in cache with LRU eviction if capacity reached
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
    logger.error('getEmbedding: failed to generate embedding vector', { error: err.message });
    throw err;
  }
}

