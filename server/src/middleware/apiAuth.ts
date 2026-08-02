import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import crypto from 'crypto';

export interface ApiAuthenticatedRequest extends Request {
  userId?: string;
  apiKeyId?: string;
  scopes?: string[];
}

/**
 * Middleware to authenticate external requests using an API Key.
 * Expects the 'Authorization' header to be in the format: 'Bearer blna_live_...'
 */
export const requireApiKey = async (req: ApiAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ success: false, error: 'Missing API key' });
    return;
  }

  try {
    // Hash the incoming token
    const keyHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find active key
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        keyHash,
        isActive: true,
      },
    });

    if (!apiKey) {
      res.status(401).json({ success: false, error: 'Invalid or revoked API key' });
      return;
    }

    // Check expiration if applicable
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      res.status(401).json({ success: false, error: 'API key has expired' });
      return;
    }

    // Update last used asynchronously
    prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() }
    }).catch(() => {});

    // Attach to request
    req.userId = apiKey.userId;
    req.apiKeyId = apiKey.id;
    try {
      req.scopes = JSON.parse(apiKey.scopes);
    } catch {
      req.scopes = [];
    }

    next();
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error during authentication' });
  }
};
