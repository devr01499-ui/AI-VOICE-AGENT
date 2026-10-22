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
  lexicalRank?: number;
  matchType: 'hybrid' | 'dense' | 'lexical';
}

export interface HybridSearchOptions {
  agentId?: string;
  kbId?: string;
  query: string;
  topK?: number;             // default 4
  minScoreThreshold?: number;// default 0.012 for RRF or 0.60 for cosine
  maxContextTokens?: number; // default 1500 tokens (~6000 chars)
  conversationContext?: string[]; // recent user/agent turns for query contextualization
}

export class HybridSearchService {
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
   * Executes Hybrid Search (Dense HNSW halfvec vector + Full-Text Lexical with RRF)
   */
  static async search(options: HybridSearchOptions): Promise<{
    results: SearchResultChunk[];
    queryRewritten: string;
    latencyMs: number;
    embeddingMs: number;
    dbQueryMs: number;
  }> {
    const tStart = Date.now();
    const effectiveQuery = this.rewriteQuery(options.query, options.conversationContext);
    const topK = options.topK || 4;
    const maxChars = (options.maxContextTokens || 1500) * 4;
    const minThreshold = options.minScoreThreshold ?? 0.012; // RRF threshold

    let embeddingMs = 0;
    let dbQueryMs = 0;

    try {
      // 1. Generate query vector (RETRIEVAL_QUERY task type)
      const tStartEmbed = Date.now();
      const queryVector = await getEmbedding(effectiveQuery, 'RETRIEVAL_QUERY');
      embeddingMs = Date.now() - tStartEmbed;

      // 2. Execute Hybrid Query in PostgreSQL using RRF fusion
      const tStartDb = Date.now();
      const vectorStr = `[${queryVector.join(',')}]`;

      // Clean query for websearch_to_tsquery
      const sanitizedFtsQuery = effectiveQuery.replace(/['":|&*]/g, ' ').trim() || 'knowledge';

      let rows: any[] = [];
      if (options.kbId) {
        rows = await prisma.$queryRawUnsafe(`
          WITH dense_search AS (
            SELECT 
              c.id, 
              c.kb_id,
              c.content, 
              c.metadata,
              (c.embedding::halfvec(3072) <=> cast($1 as vector)::halfvec(3072)) as distance,
              ROW_NUMBER() OVER (ORDER BY (c.embedding::halfvec(3072) <=> cast($1 as vector)::halfvec(3072)) ASC) as dense_rank
            FROM "kb_chunks" c
            WHERE c."kb_id" = $2
            ORDER BY distance ASC
            LIMIT 20
          ),
          lexical_search AS (
            SELECT 
              c.id, 
              c.kb_id,
              c.content, 
              c.metadata,
              ts_rank_cd(to_tsvector('english', c.content), websearch_to_tsquery('english', $3)) as rank,
              ROW_NUMBER() OVER (ORDER BY ts_rank_cd(to_tsvector('english', c.content), websearch_to_tsquery('english', $3)) DESC) as lex_rank
            FROM "kb_chunks" c
            WHERE c."kb_id" = $2 
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
          LIMIT 10;
        `, vectorStr, options.kbId, sanitizedFtsQuery);
      } else if (options.agentId) {
        rows = await prisma.$queryRawUnsafe(`
          WITH dense_search AS (
            SELECT 
              c.id, 
              c.kb_id,
              c.content, 
              c.metadata,
              (c.embedding::halfvec(3072) <=> cast($1 as vector)::halfvec(3072)) as distance,
              ROW_NUMBER() OVER (ORDER BY (c.embedding::halfvec(3072) <=> cast($1 as vector)::halfvec(3072)) ASC) as dense_rank
            FROM "kb_chunks" c
            JOIN "agent_knowledge_bases" akb ON c."kb_id" = akb."kb_id"
            WHERE akb."agent_id" = $2
            ORDER BY distance ASC
            LIMIT 20
          ),
          lexical_search AS (
            SELECT 
              c.id, 
              c.kb_id,
              c.content, 
              c.metadata,
              ts_rank_cd(to_tsvector('english', c.content), websearch_to_tsquery('english', $3)) as rank,
              ROW_NUMBER() OVER (ORDER BY ts_rank_cd(to_tsvector('english', c.content), websearch_to_tsquery('english', $3)) DESC) as lex_rank
            FROM "kb_chunks" c
            JOIN "agent_knowledge_bases" akb ON c."kb_id" = akb."kb_id"
            WHERE akb."agent_id" = $2 
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
          LIMIT 10;
        `, vectorStr, options.agentId, sanitizedFtsQuery);
      } else {
        throw new Error('Either agentId or kbId must be specified for search');
      }

      dbQueryMs = Date.now() - tStartDb;
      const totalLatencyMs = Date.now() - tStart;

      // 3. Parse metadata, enforce relevance threshold, and accumulate chunks up to maxChars
      const candidateChunks: SearchResultChunk[] = [];
      let totalAccumulatedChars = 0;

      for (const row of rows) {
        const score = Number(row.rrf_score || 0);
        
        // Strict relevance gate:
        // A chunk is relevant ONLY IF it matches lexical search OR has close semantic vector similarity (distance <= 0.35)
        const hasLexicalMatch = row.lex_rank != null && Number(row.lexical_rank || 0) > 0;
        const isCloseVectorMatch = row.dense_distance != null && Number(row.dense_distance) <= 0.15;

        if (!hasLexicalMatch && !isCloseVectorMatch) {
          continue; // Rejected as irrelevant / out-of-domain!
        }

        let meta: any = {};
        try {
          meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
        } catch {}

        const content = (row.content || '').trim();
        if (!content) continue;

        // Check token/char budget
        if (totalAccumulatedChars + content.length > maxChars && candidateChunks.length >= 1) {
          break;
        }

        const matchType: 'hybrid' | 'dense' | 'lexical' = 
          row.dense_rank && row.lex_rank ? 'hybrid' : row.dense_rank ? 'dense' : 'lexical';

        candidateChunks.push({
          id: row.id,
          kbId: row.kb_id,
          content, // FULL chunk returned! No 350-character cut!
          source: meta.source || 'Knowledge Base',
          section: meta.section || 'General',
          page: meta.page,
          score,
          denseDistance: row.dense_distance ? Number(row.dense_distance) : undefined,
          lexicalRank: row.lexical_rank ? Number(row.lexical_rank) : undefined,
          matchType,
        });

        totalAccumulatedChars += content.length;
        if (candidateChunks.length >= topK) {
          break;
        }
      }

      logger.info('HybridSearchService: query executed', {
        agentId: options.agentId,
        query: options.query,
        queryRewritten: effectiveQuery,
        returnedChunks: candidateChunks.length,
        topScore: candidateChunks[0]?.score,
        embeddingMs,
        dbQueryMs,
        totalLatencyMs,
      });

      return {
        results: candidateChunks,
        queryRewritten: effectiveQuery,
        latencyMs: totalLatencyMs,
        embeddingMs,
        dbQueryMs,
      };
    } catch (err: any) {
      logger.error('HybridSearchService: search execution failed', { error: err.message });
      throw err;
    }
  }
}
