import { PDFParse } from 'pdf-parse';
import { logger } from './logger';

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = result.text ? result.text.trim() : '';

    // Detect empty or near-empty PDFs (which are typically scanned/image-only PDFs)
    if (!text || text.length < 50) {
      throw new Error(
        'The uploaded PDF seems to be scanned, empty, or image-only. ' +
        'Currently, scanned PDFs requiring OCR are not supported.'
      );
    }

    logger.info('extractTextFromPdf: successfully parsed PDF', {
      pagesCount: result.pages.length,
      charsCount: text.length
    });

    return text;
  } catch (err: any) {
    logger.error('extractTextFromPdf: error parsing PDF', { error: err.message });
    throw err;
  }
}
