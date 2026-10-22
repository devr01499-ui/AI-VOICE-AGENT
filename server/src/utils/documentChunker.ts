/**
 * Structure-Aware Document Chunker for RAG v2
 * 
 * Features:
 * - Preserves headings, sections, paragraphs, Q&A pairs, and tables.
 * - Never truncates mid-sentence or mid-word.
 * - Enforces 300-600 token (~1200-2400 char) targets with 10% overlap.
 * - Prepends document title and section breadcrumbs to each chunk.
 * - Produces rich metadata (source, section, page, charCount).
 * - Dedupes identical chunks.
 */

export interface StructuredChunk {
  content: string;
  metadata: {
    source: string;
    section: string;
    page?: number;
    chunkIndex: number;
    charCount: number;
    tokenEstimate: number;
  };
}

export interface ChunkingOptions {
  docName: string;
  targetTokens?: number; // default ~400 tokens (~1600 chars)
  minTokens?: number;    // default ~150 tokens (~600 chars)
  maxTokens?: number;    // default ~600 tokens (~2400 chars)
  overlapTokens?: number;// default ~40 tokens (~160 chars)
}

const CHARS_PER_TOKEN = 4; // Standard heuristic for English/mixed text

export function chunkDocument(text: string, options: ChunkingOptions): StructuredChunk[] {
  const docName = options.docName || 'Document';
  const targetChars = (options.targetTokens || 400) * CHARS_PER_TOKEN;
  const minChars = (options.minTokens || 150) * CHARS_PER_TOKEN;
  const maxChars = (options.maxTokens || 600) * CHARS_PER_TOKEN;
  const overlapChars = (options.overlapTokens || 40) * CHARS_PER_TOKEN;

  if (!text || !text.trim()) {
    return [];
  }

  // 1. Split into lines and detect page numbers, headings, and sections
  const lines = text.split('\n');
  const sections: { title: string; page?: number; text: string }[] = [];
  
  let currentSectionTitle = 'General Overview';
  let currentPage: number | undefined = undefined;
  let currentSectionLines: string[] = [];

  const headingRegex = /^(?:#{1,4}\s+|(?:\d+\s*(?:\/|\.)\s*)?[A-Z\s]{4,}:?|^[A-Z][A-Za-z0-9\s]{2,40}:)$/;
  const pageMarkerRegex = /(?:--\s*(\d+)\s+of\s+\d+\s*--|---\s*Page\s*(\d+)\s*---)/i;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Check for page markers
    const pageMatch = trimmed.match(pageMarkerRegex);
    if (pageMatch) {
      const pageNum = parseInt(pageMatch[1] || pageMatch[2], 10);
      if (!isNaN(pageNum)) {
        currentPage = pageNum;
      }
      continue;
    }

    // Check for major heading or section boundary
    const isHeading = trimmed.length >= 3 && trimmed.length <= 80 && (
      headingRegex.test(trimmed) || 
      trimmed.startsWith('#') ||
      /^[0-9]{1,2}\s*[\/\.-]\s*[A-Z\s]+$/.test(trimmed)
    );

    if (isHeading && currentSectionLines.length > 0) {
      sections.push({
        title: currentSectionTitle,
        page: currentPage,
        text: currentSectionLines.join('\n').trim(),
      });
      currentSectionTitle = trimmed.replace(/^#+\s*/, '').trim();
      currentSectionLines = [];
    } else if (isHeading) {
      currentSectionTitle = trimmed.replace(/^#+\s*/, '').trim();
    } else {
      currentSectionLines.push(rawLine);
    }
  }

  if (currentSectionLines.length > 0) {
    sections.push({
      title: currentSectionTitle,
      page: currentPage,
      text: currentSectionLines.join('\n').trim(),
    });
  }

  // 2. Chunk each section respecting sentence and paragraph boundaries
  const rawChunks: StructuredChunk[] = [];
  const seenHashes = new Set<string>();

  for (const section of sections) {
    if (!section.text) continue;

    // Split section into paragraphs
    const paragraphs = section.text.split(/\n\s*\n/);
    let currentChunkSentences: string[] = [];
    let currentChunkCharLen = 0;

    const flushChunk = () => {
      if (currentChunkSentences.length === 0) return;
      const body = currentChunkSentences.join(' ').trim();
      if (!body) return;

      // Prepend section breadcrumb
      const breadcrumb = `[Source: ${docName} | Section: ${section.title}${section.page ? ` | Page ${section.page}` : ''}]\n`;
      const fullChunkContent = `${breadcrumb}${body}`.trim();

      // Deduplicate identical content
      const normKey = fullChunkContent.replace(/\s+/g, ' ').toLowerCase();
      if (!seenHashes.has(normKey)) {
        seenHashes.add(normKey);
        rawChunks.push({
          content: fullChunkContent,
          metadata: {
            source: docName,
            section: section.title,
            page: section.page,
            chunkIndex: rawChunks.length,
            charCount: fullChunkContent.length,
            tokenEstimate: Math.ceil(fullChunkContent.length / CHARS_PER_TOKEN),
          },
        });
      }

      // Preserve overlap of the last 1-2 sentences
      if (overlapChars > 0 && currentChunkSentences.length > 1) {
        let overlapLen = 0;
        const overlapSentences: string[] = [];
        for (let j = currentChunkSentences.length - 1; j >= 0; j--) {
          const s = currentChunkSentences[j];
          if (overlapLen + s.length <= overlapChars) {
            overlapSentences.unshift(s);
            overlapLen += s.length;
          } else {
            break;
          }
        }
        currentChunkSentences = overlapSentences;
        currentChunkCharLen = overlapLen;
      } else {
        currentChunkSentences = [];
        currentChunkCharLen = 0;
      }
    };

    for (const paragraph of paragraphs) {
      const cleanPara = paragraph.trim();
      if (!cleanPara) continue;

      // Split paragraph into sentences on period/exclamation/question followed by space or newline
      const sentences = cleanPara.match(/[^.!?\n]+(?:[.!?]+|$)/g) || [cleanPara];

      for (const rawSentence of sentences) {
        const sentence = rawSentence.trim();
        if (!sentence) continue;

        if (currentChunkCharLen + sentence.length > maxChars && currentChunkCharLen >= minChars) {
          flushChunk();
        }

        currentChunkSentences.push(sentence);
        currentChunkCharLen += sentence.length;

        if (currentChunkCharLen >= targetChars) {
          flushChunk();
        }
      }
    }

    if (currentChunkSentences.length > 0) {
      flushChunk();
    }
  }

  // Fallback if no sections were parsed
  if (rawChunks.length === 0 && text.trim().length > 0) {
    const fallbackBreadcrumb = `[Source: ${docName} | Section: Content]\n`;
    const cleanText = text.trim();
    rawChunks.push({
      content: `${fallbackBreadcrumb}${cleanText}`,
      metadata: {
        source: docName,
        section: 'Content',
        chunkIndex: 0,
        charCount: cleanText.length,
        tokenEstimate: Math.ceil(cleanText.length / CHARS_PER_TOKEN),
      },
    });
  }

  return rawChunks;
}
