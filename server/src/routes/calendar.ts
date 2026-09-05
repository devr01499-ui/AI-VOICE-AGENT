import crypto from 'crypto';
import { Router } from 'express';
import { google } from 'googleapis';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { getUserIdFromRequest } from '../utils/auth';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { scheduleCall, cancelBooking, rescheduleBooking } from '../lib/calendar/scheduler';

const router = Router();

const getOauth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    // Provide a sensible default or environment variable for redirect URI
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5174/api/v2/calendar/callback'
  );
};

/**
 * GET /api/v2/calendar/auth
 * Generates an OAuth URL and redirects the user to Google.
 */
router.get('/auth', requireAuth, (req, res) => {
  try {
    const oauth2Client = getOauth2Client();
    const scopes = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly'
    ];

    // Use HMAC-signed state with timestamp to pass user ID securely through OAuth flow
    const userId = getUserIdFromRequest(req);
    const secret = env.SIP_ENCRYPTION_KEY;
    const payload = JSON.stringify({ userId, timestamp: Date.now() });
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const state = Buffer.from(JSON.stringify({ payload, signature })).toString('base64');

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
      state: state
    });

    res.redirect(url);
  } catch (error) {
    logger.error('Failed to generate Google Calendar auth URL', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

/**
 * GET /api/v2/calendar/callback
 * Handles the OAuth callback from Google.
 * Verifies HMAC state signature and timestamp to prevent CSRF.
 */
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    logger.error('Google Calendar OAuth error', { error });
    return res.redirect('/?error=calendar_auth_failed');
  }

  if (!code || !state) {
    return res.status(400).send('Missing code or state parameter');
  }

  try {
    const secret = env.SIP_ENCRYPTION_KEY;
    const { payload, signature } = JSON.parse(Buffer.from(state as string, 'base64').toString('utf-8'));
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    if (signature !== expectedSignature) {
      logger.warn('Google Calendar OAuth callback: invalid state signature');
      return res.status(403).send('Invalid or tampered OAuth state parameter');
    }

    const { userId, timestamp } = JSON.parse(payload);
    if (!userId || !timestamp || (Date.now() - timestamp > 15 * 60 * 1000)) {
      logger.warn('Google Calendar OAuth callback: expired or invalid state payload');
      return res.status(403).send('OAuth state expired or invalid');
    }

    const oauth2Client = getOauth2Client();
    const { tokens } = await oauth2Client.getToken(code as string);

    // Ensure we actually got tokens
    if (tokens) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          googleCalendarTokens: JSON.stringify(tokens)
        }
      });
      logger.info('Successfully connected Google Calendar', { userId });
      
      // Redirect back to the agents dashboard or a specific settings page
      res.redirect('/?success=calendar_connected');
    } else {
      res.redirect('/?error=calendar_auth_failed_no_tokens');
    }

  } catch (error) {
    logger.error('Failed to handle Google Calendar callback', { error: error instanceof Error ? error.message : String(error) });
    res.redirect('/?error=calendar_auth_failed');
  }
});

/**
 * GET /api/v2/calendar/status
 * Returns whether the current user has linked their Google Calendar.
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { googleCalendarTokens: true }
    });

    res.json({
      connected: !!user?.googleCalendarTokens
    });
  } catch (error) {
    logger.error('Failed to get Google Calendar status', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to get status' });
  }
});

/**
 * DELETE /api/v2/calendar
 * Disconnects the Google Calendar.
 */
router.delete('/', requireAuth, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await prisma.user.update({
      where: { id: userId },
      data: { googleCalendarTokens: null }
    });
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to disconnect Google Calendar', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to disconnect calendar' });
  }
});

/**
 * GET /api/v2/calendar/bookings
 */
router.get('/bookings', requireAuth, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const calls = await prisma.call.findMany({
      where: {
        userId,
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    const bookings = calls.map(c => ({
      id: c.id,
      source: 'ai_booked',
      phoneNumber: c.recipientPhoneNumber,
      scheduledAtUtc: c.createdAt.toISOString(),
      timezone: 'Asia/Kolkata',
      status: c.status === 'queued' ? 'scheduled' : c.status,
      notes: `Call via agent ${c.agentId.slice(0, 8)}`,
    }));

    res.json(bookings);
  } catch (error) {
    logger.error('Failed to get bookings', { error: String(error) });
    res.status(500).json({ error: 'Failed to get bookings' });
  }
});

/**
 * GET /api/v2/calendar/batches
 */
router.get('/batches', requireAuth, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const batches = await prisma.batch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = batches.map(b => ({
      id: b.id,
      name: b.name,
      status: b.status,
      completedCount: b.completedCount,
      totalContacts: b.totalRecipients,
    }));

    res.json(formatted);
  } catch (error) {
    logger.error('Failed to get batches', { error: String(error) });
    res.status(500).json({ error: 'Failed to get batches' });
  }
});

export default router;
