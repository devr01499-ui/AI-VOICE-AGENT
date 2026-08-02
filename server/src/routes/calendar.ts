import { Router } from 'express';
import { google } from 'googleapis';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { getUserIdFromRequest } from '../utils/auth';
import { logger } from '../utils/logger';

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

    // Use state to pass the user ID safely through the OAuth flow
    const userId = getUserIdFromRequest(req);
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

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
 * NOTE: This endpoint may not have the standard Auth header since it's a browser redirect, 
 * so we decode the state parameter to get the userId.
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
    const decodedState = JSON.parse(Buffer.from(state as string, 'base64').toString('utf-8'));
    const userId = decodedState.userId;

    if (!userId) {
      return res.status(400).send('Invalid state parameter');
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

export default router;
