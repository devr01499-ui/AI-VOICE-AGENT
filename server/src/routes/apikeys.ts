import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import crypto from 'crypto';

const router = Router();

// Get all API keys for the user
router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      }
    });
    res.json({ success: true, data: apiKeys });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch API keys' });
  }
});

// Generate a new API key
router.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { name } = req.body;
    
    // Generate a random 32-byte key
    const rawKey = crypto.randomBytes(32).toString('hex');
    const prefix = 'blna_live_';
    const fullKey = prefix + rawKey;
    
    // Hash the full key for storage
    const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');
    
    const apiKey = await prisma.apiKey.create({
      data: {
        userId: req.userId!,
        name: name || 'Default API Key',
        keyHash,
        keyPrefix: prefix,
        scopes: JSON.stringify(['*']),
      }
    });

    // Return the plaintext key EXACTLY ONCE
    res.json({ 
      success: true, 
      data: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        key: fullKey,
        createdAt: apiKey.createdAt
      }
    });
  } catch (error) {
    console.error('Error generating API key:', error);
    res.status(500).json({ success: false, error: 'Failed to generate API key' });
  }
});

// Revoke an API key
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id as string;
    
    const apiKey = await prisma.apiKey.findUnique({
      where: { id }
    });

    if (!apiKey || apiKey.userId !== req.userId) {
      return res.status(404).json({ success: false, error: 'API key not found' });
    }

    await prisma.apiKey.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting API key:', error);
    res.status(500).json({ success: false, error: 'Failed to revoke API key' });
  }
});

export default router;
