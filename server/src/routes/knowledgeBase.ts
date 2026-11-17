import express, { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireEditor } from '../middleware/auth';
import { requireActivePlanOrBYOK } from '../middleware/planValidation';
import { kbIngestLimiter, kbWriteLimiter, kbQueryLimiter } from '../middleware/rateLimiter';
import { KnowledgeBaseController, KB_PLATFORM_MAX_FILE_MB } from '../controllers/KnowledgeBaseController';

const router = Router();

/** Full path of the upload route; the global 10 MB JSON parser skips it (see index.ts). */
export const KB_UPLOAD_PATH = '/api/v2/knowledge-base/upload';

/** Base64 adds a third; this fits the largest allowed file plus the JSON wrapper. */
const UPLOAD_BODY_LIMIT_BYTES = Math.ceil(KB_PLATFORM_MAX_FILE_MB * 1024 * 1024 * 1.37) + 64 * 1024;

/**
 * Backpressure for large uploads: at most MAX_UPLOADS_IN_FLIGHT upload bodies are held in memory
 * at once on this server; extra uploads get a clear "busy, retry" answer instead of exhausting RAM.
 */
export const MAX_UPLOADS_IN_FLIGHT = 4;
let uploadsInFlight = 0;
export function uploadGate(req: Request, res: Response, next: NextFunction): void {
  if (uploadsInFlight >= MAX_UPLOADS_IN_FLIGHT) {
    res.setHeader('Retry-After', '15');
    res.status(503).json({ success: false, error: 'Many documents are being uploaded right now. Please try again in a few seconds.', code: 'KB_UPLOAD_BUSY' });
    return;
  }
  uploadsInFlight++;
  let released = false;
  const release = () => { if (!released) { released = true; uploadsInFlight--; } };
  res.on('finish', release);
  res.on('close', release);
  next();
}

const uploadBodyParser = express.json({ limit: UPLOAD_BODY_LIMIT_BYTES });

/** Turns an over-size body into a clear message instead of a bare 413 from the parser. */
function uploadBodyErrors(err: any, req: Request, res: Response, next: NextFunction): void {
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ success: false, error: `File is too large. The maximum is ${KB_PLATFORM_MAX_FILE_MB} MB per file.`, code: 'KB_FILE_TOO_LARGE' });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ success: false, error: 'The upload could not be read. Please try again.' });
    return;
  }
  next(err);
}

router.get('/limits', requireAuth, KnowledgeBaseController.limits);
router.post('/upload', requireAuth, requireEditor, kbIngestLimiter, uploadGate, uploadBodyParser, uploadBodyErrors, requireActivePlanOrBYOK, KnowledgeBaseController.upload);
router.post('/scrape', requireAuth, requireEditor, kbIngestLimiter, requireActivePlanOrBYOK, KnowledgeBaseController.scrape);
router.get('/', requireAuth, KnowledgeBaseController.list);
router.delete('/:id', requireAuth, requireEditor, kbWriteLimiter, KnowledgeBaseController.delete);
router.post('/:id/reindex', requireAuth, requireEditor, kbIngestLimiter, KnowledgeBaseController.reindex);
router.post('/test-query', requireAuth, kbQueryLimiter, KnowledgeBaseController.testQuery);
router.post('/:id/assign', requireAuth, requireEditor, kbWriteLimiter, KnowledgeBaseController.assignToAgent);
router.post('/:id/unassign', requireAuth, requireEditor, kbWriteLimiter, KnowledgeBaseController.unassignFromAgent);
router.post('/:id/update-agents', requireAuth, requireEditor, kbWriteLimiter, KnowledgeBaseController.updateAgentAssignments);

export default router;
