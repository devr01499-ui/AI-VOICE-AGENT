import { prisma } from '../lib/prisma';
import { getEmbedding } from '../utils/embedding';
import { logger } from '../utils/logger';

export interface SearchResultChunk {
  id: string;
  kbId: string;
  content: string;
  source: string;
  section: string;
  page?: number;
  score: number;
  denseDistance?: number;
  /** 1 − cosine distance, 0..1 (only for chunks found by meaning). */
  similarity?: number;
  lexicalRank?: number;
  matchType: 'hybrid' | 'dense' | 'lexical';
  /** False for near-misses the relevance gate keeps away from live calls (inspector only). */
  usedOnCalls?: boolean;
}

export interface HybridSearchOptions {
  agentId?: string;
  kbId?: string;
  /** Owner of the documents. When set, every search path is limited to this workspace. */
  workspaceId?: string;
  userId?: string;
  query: string;
  topK?: number;             // default 4
  minScoreThreshold?: number;// kept for callers; the relevance gate below decides what is used
  maxContextTokens?: number; // default 1500 tokens (~6000 chars)
  conversationContext?: string[]; // recent user/agent turns for query contextualization
  /** Whole-search time budget. Default 8 s; live calls pass a short budget. */
  timeoutMs?: number;
  /** Inspector: also return the best chunks the relevance gate rejected (marked usedOnCalls=false). */
  includeRejected?: boolean;
}

export class KbSearchTimeoutError extends Error {
  constructor(ms: number) {
    super(`Knowledge base search took longer than ${ms} ms`);
    this.name = 'KbSearchTimeoutError';
  }
}

/**
 * Relevance gate for live calls. A chunk reaches the voice agent only if it matches the caller's
 * words (full-text) or is very close in meaning (cosine distance <= this value, i.e. similarity
 * >= 0.85). Deliberately strict: a wrong fact on a call is worse than "let me check". The Retrieval
 * Inspector shows near-misses with their similarity so this can be tuned on real documents.
 */
export const DENSE_DISTANCE_GATE = 0.15;
export const DEFAULT_SEARCH_TIMEOUT_MS = 8000;
export const LIVE_CALL_SEARCH_TIMEOUT_MS = 2500;

type Scope = { join: string; where: string; params: unknown[] };

/** Scope SQL is built only from constants; every value is a bound parameter. */
function buildScope(options: HybridSearchOptions): Scope {
  const owner = options.workspaceId || options.userId;
  if (options.kbId) {
    return owner
      ? { join: '', where: 'c."kb_id" = $2 AND kb."user_id" = $4', params: [options.kbId, owner] }
      : { join: '', where: 'c."kb_id" = $2', params: [options.kbId] };
  }
  if (options.agentId) {
    const join = 'JOIN "agent_knowledge_bases" akb ON c."kb_id" = akb."kb_id"';
    return owner
      ? { join, where: 'akb."agent_id" = $2 AND kb."user_id" = $4', params: [options.agentId, owner] }
      : { join, where: 'akb."agent_id" = $2', params: [options.agentId] };
  }
  if (owner) {
    return { join: '', where: 'kb."user_id" = $2', params: [owner] };
  }
  throw new Error('agentId, kbId, or workspaceId must be specified for search');
}

function hybridSql(scope: Scope): string {
  const from = `FROM "kb_chunks" c JOIN "knowledge_bases" kb ON c."kb_id" = kb."id" ${scope.join}`;
  return `
    WITH dense_search AS (
      SELECT c.id, c.kb_id, c.content, c.metadata,
        (c.embedding::halfvec(3072) <=> cast($1 as vector)::halfvec(3072)) as distance,
        ROW_NUMBER() OVER (ORDER BY (c.embedding::halfvec(3072) <=> cast($1 as vector)::halfvec(3072)) ASC) as dense_rank
      ${from}
      WHERE ${scope.where}
      ORDER BY distance ASC
      LIMIT 20
    ),
    lexical_search AS (
      SELECT c.id, c.kb_id, c.content, c.metadata,
        ts_rank_cd(to_tsvector('english', c.content), websearch_to_tsquery('english', $3)) as rank,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(to_tsvector('english', c.content), websearch_to_tsquery('english', $3)) DESC) as lex_rank
      ${from}
      WHERE ${scope.where}
        AND to_tsvector('english', c.content) @@ websearch_to_tsquery('english', $3)
      ORDER BY rank DESC
      LIMIT 20
    ),
    fused AS (
      SELECT
        COALESCE(d.id, l.id) as id,
        COALESCE(d.kb_id, l.kb_id) as kb_id,
        COALESCE(d.content, l.content) as content,
        COALESCE(d.metadata, l.metadata) as metadata,
        d.distance as dense_distance,
        l.rank as lexical_rank,
        d.dense_rank,
        l.lex_rank,
        (COALESCE(1.0 / (60.0 + d.dense_rank), 0.0) + COALESCE(1.0 / (60.0 + l.lex_rank), 0.0)) as rrf_score
      FROM dense_search d
      FULL OUTER JOIN lexical_search l ON d.id = l.id
    )
    SELECT * FROM fused
    ORDER BY rrf_score DESC
    LIMIT 10;`;
}

export class HybridSearchService {
  private static readonly queryCache = new Map<string, { expires: number; data: any }>();

  static getCachedResult(cacheKey: string) {
    const entry = this.queryCache.get(cacheKey);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.queryCache.delete(cacheKey);
      return null;
    }
    return entry.data;
  }

  static setCachedResult(cacheKey: string, data: any, ttlMs: number = 300000) {
    // Keep max 500 items in cache
    if (this.queryCache.size >= 500) {
      const firstKey = this.queryCache.keys().next().value;
      if (firstKey) this.queryCache.delete(firstKey);
    }
    this.queryCache.set(cacheKey, { expires: Date.now() + ttlMs, data });
  }
  /**
   * Rewrites short or ambiguous query using previous conversational context turns.
   */
  static rewriteQuery(rawQuery: string, conversationContext?: string[]): string {
    if (!conversationContext || conversationContext.length === 0) {
      return rawQuery;
    }
    const cleanQuery = rawQuery.trim();
    // If the query is already self-contained (>= 6 words and contains key entities), keep it
    if (cleanQuery.split(/\s+/).length >= 6) {
      return cleanQuery;
    }

    // Extract nouns/keywords from the last 2 conversation turns
    const recentContext = conversationContext.slice(-2).join(' ');
    const contextKeywords = recentContext
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !['what', 'when', 'where', 'which', 'about', 'there', 'their', 'would', 'could', 'should'].includes(w.toLowerCase()))
      .slice(-4)
      .join(' ');

    if (contextKeywords) {
      return `${cleanQuery} ${contextKeywords}`.trim();
    }
    return cleanQuery;
  }

  /**
   * Hybrid search (meaning + full-text, fused with reciprocal rank fusion), always limited to the
   * caller's scope, within a time budget.
   */
  static async search(options: HybridSearchOptions): Promise<{
    results: SearchResultChunk[];
    rejected?: SearchResultChunk[];
    queryRewritten: string;
    latencyMs: number;
    embeddingMs: number;
    dbQueryMs: number;
  }> {
    const timeoutMs = options.timeoutMs && options.timeoutMs > 0 ? options.timeoutMs : DEFAULT_SEARCH_TIMEOUT_MS;
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new KbSearchTimeoutError(timeoutMs)), timeoutMs);
    });
    try {
      return await Promise.race([this.runSearch(options), deadline]);
    } catch (err: any) {
      logger.error('HybridSearchService: search execution failed', { error: err?.message, timeout: err instanceof KbSearchTimeoutError });
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private static async runSearch(options: HybridSearchOptions) {
    const tStart = Date.now();
    const scope = buildScope(options); // validates scope before any paid embedding call
    const effectiveQuery = this.rewriteQuery(options.query, options.conversationContext);
    const topK = Math.min(Math.max(options.topK || 4, 1), 10);
    const maxChars = (options.maxContextTokens || 1500) * 4;

    // 1. Query vector (RETRIEVAL_QUERY task type)
    const tStartEmbed = Date.now();
    const queryVector = await getEmbedding(effectiveQuery, 'RETRIEVAL_QUERY');
    const embeddingMs = Date.now() - tStartEmbed;

    // 2. Hybrid query in PostgreSQL
    const tStartDb = Date.now();
    const vectorStr = `[${queryVector.join(',')}]`;
    const sanitizedFtsQuery = effectiveQuery.replace(/['":|&*]/g, ' ').trim() || 'knowledge';
    const [scopeValue, ...rest] = scope.params;
    const rows: any[] = await prisma.$queryRawUnsafe(hybridSql(scope), vectorStr, scopeValue, sanitizedFtsQuery, ...rest);
    const dbQueryMs = Date.now() - tStartDb;

    // 3. Relevance gate + context budget
    const results: SearchResultChunk[] = [];
    const rejected: SearchResultChunk[] = [];
    let totalAccumulatedChars = 0;

    for (const row of rows) {
      let meta: any = {};
      try {
        meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
      } catch { /* metadata is optional */ }

      const content = (row.content || '').trim();
      if (!content) continue;

      const denseDistance = row.dense_distance != null ? Number(row.dense_distance) : undefined;
      const hasLexicalMatch = row.lex_rank != null && Number(row.lexical_rank || 0) > 0;
      const isCloseVectorMatch = denseDistance != null && denseDistance <= DENSE_DISTANCE_GATE;
      const chunk: SearchResultChunk = {
        id: row.id,
        kbId: row.kb_id,
        content,
        source: meta.source || 'Knowledge Base',
        section: meta.section || 'General',
        page: meta.page,
        score: Number(row.rrf_score || 0),
        denseDistance,
        similarity: denseDistance != null ? Math.max(0, Math.min(1, 1 - denseDistance)) : undefined,
        lexicalRank: row.lexical_rank ? Number(row.lexical_rank) : undefined,
        matchType: row.dense_rank && row.lex_rank ? 'hybrid' : row.dense_rank ? 'dense' : 'lexical',
      };

      if (!hasLexicalMatch && !isCloseVectorMatch) {
        if (options.includeRejected && rejected.length < topK) rejected.push({ ...chunk, usedOnCalls: false });
        continue;
      }
      if (results.length >= topK) continue;
      if (totalAccumulatedChars + content.length > maxChars && results.length >= 1) continue;

      results.push({ ...chunk, usedOnCalls: true });
      totalAccumulatedChars += content.length;
    }

    const latencyMs = Date.now() - tStart;
    logger.info('HybridSearchService: query executed', {
      agentId: options.agentId,
      kbId: options.kbId,
      queryChars: options.query.length,
      returnedChunks: results.length,
      rejectedChunks: rejected.length,
      topScore: results[0]?.score,
      embeddingMs,
      dbQueryMs,
      totalLatencyMs: latencyMs,
    });

    return {
      results,
      ...(options.includeRejected ? { rejected } : {}),
      queryRewritten: effectiveQuery,
      latencyMs,
      embeddingMs,
      dbQueryMs,
    };
  }
}
