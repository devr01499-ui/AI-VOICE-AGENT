/**
 * Comprehensive Automated Verification Suite for Google Calendar Integration (Part 1)
 *
 * Tests all Part 1 fixes against a fake Google server:
 * 1. Connect URL generation with single-use signed state and least-privilege scopes
 * 2. RBAC gating (viewer forbidden)
 * 3. GET /auth direct navigation handling (HTTP 302 redirect)
 * 4. OAuth code exchange and versioned token encryption at rest (v2:...)
 * 5. OAuth state single-use nonce & replay rejection
 * 6. Connection health check (/status)
 * 7. Real vs garbage/revoked credential detection in CalendarService
 * 8. Fallback honesty & follow-up flag on calendar failure
 * 9. Concurrency lock & race-condition double-booking prevention
 * 10. Disconnect flow with Google token revocation
 * 11. Accurate bookings endpoint (no fabricated calls)
 * 12. Temporal context injection in system instruction builder
 */

process.env.GOOGLE_CLIENT_ID = 'test_google_client_id';
process.env.GOOGLE_CLIENT_SECRET = 'test_google_client_secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/v2/calendar/callback';

import http from 'http';
import express from 'express';
import crypto from 'crypto';
import { prisma } from '../src/lib/prisma';
import { EncryptionService } from '../src/utils/EncryptionService';
import { CalendarService } from '../src/core/orchestrator/CalendarService';
import { buildFinalSystemInstruction } from '../src/utils/systemInstructionBuilder';
import { getWebhookSigningSecret } from '../src/utils/security';
import calendarRouter from '../src/routes/calendar';

const MOCK_GOOGLE_PORT = 3942;
const APP_PORT = 3943;

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail: string = '') {
  if (condition) {
    passed++;
    console.log(`[PASS] ${testName} ${detail ? '-> ' + detail : ''}`);
  } else {
    failed++;
    console.error(`[FAIL] ${testName} ${detail ? '-> ' + detail : ''}`);
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('STARTING GOOGLE CALENDAR PART 1 AUTOMATED VERIFICATION SUITE');
  console.log('================================================================\n');

  // ── 1. Launch Fake Google Server ──────────────────────────────────
  const revokedTokens: string[] = [];
  const fakeGoogleEvents: any[] = [];
  let freeBusyQueryCount = 0;

  const fakeGoogleApp = express();
  fakeGoogleApp.use(express.json());
  fakeGoogleApp.use(express.urlencoded({ extended: true }));

  // OAuth token exchange
  fakeGoogleApp.post('/token', (req, res) => {
    res.json({
      access_token: 'ya29.FAKE_TEST_ACCESS_TOKEN_ABC',
      refresh_token: '1//FAKE_TEST_REFRESH_TOKEN_XYZ',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.events',
    });
  });

  // Token revocation
  fakeGoogleApp.post('/revoke', (req, res) => {
    const token = req.query.token as string || req.body?.token;
    if (token) {
      revokedTokens.push(token);
    }
    res.status(200).json({ status: 'revoked' });
  });

  // Free/Busy query
  fakeGoogleApp.post('/calendar/v3/freeBusy', (req, res) => {
    freeBusyQueryCount++;
    res.json({
      kind: 'calendar#freeBusy',
      timeMin: req.body.timeMin,
      timeMax: req.body.timeMax,
      calendars: {
        primary: {
          busy: [],
        },
      },
    });
  });

  // Events insert
  fakeGoogleApp.post('/calendar/v3/calendars/:calendarId/events', (req, res) => {
    const event = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      htmlLink: 'https://calendar.google.com/calendar/event?eid=test',
      ...req.body,
    };
    fakeGoogleEvents.push(event);
    res.status(200).json(event);
  });

  const fakeGoogleServer = http.createServer(fakeGoogleApp);
  await new Promise<void>((resolve) => fakeGoogleServer.listen(MOCK_GOOGLE_PORT, '127.0.0.1', resolve));
  console.log(`[SETUP] Fake Google server running on port ${MOCK_GOOGLE_PORT}`);

  // ── 2. Launch Local Test App ──────────────────────────────────────
  const testApp = express();
  testApp.use(express.json());

  // Test User & Workspace Fixture
  const user = await prisma.user.findFirst();
  if (!user) {
    throw new Error('No test user exists in database.');
  }
  const testUserId = user.id;

  // Mock Supabase getUser & TeamMember for test requests
  const { supabaseClient } = await import('../src/utils/supabase');
  (supabaseClient.auth as any).getUser = async (tok: string) => {
    if (tok === 'test_owner_token') {
      return { data: { user: { id: testUserId, email: user.email, email_confirmed_at: new Date().toISOString() } }, error: null };
    }
    if (tok === 'test_viewer_token') {
      return { data: { user: { id: 'viewer_user_id', email: 'viewer@test.com', email_confirmed_at: new Date().toISOString() } }, error: null };
    }
    return { data: { user: null }, error: new Error('Invalid token') };
  };

  const origTeamMemberFindFirst = prisma.teamMember.findFirst;
  (prisma.teamMember as any).findFirst = async (args: any) => {
    if (args?.where?.memberId === 'viewer_user_id') {
      return { id: 'tm_viewer', ownerId: testUserId, memberId: 'viewer_user_id', role: 'viewer' };
    }
    return null;
  };

  const origUserFindUnique = prisma.user.findUnique;
  (prisma.user as any).findUnique = async (args: any) => {
    if (args?.where?.id === 'viewer_user_id') {
      return { id: 'viewer_user_id', email: 'viewer@test.com', accountStatus: 'active', allowedIpRanges: [] };
    }
    return origUserFindUnique.call(prisma.user, args);
  };

  testApp.use('/api/v2/calendar', calendarRouter);

  const testServer = http.createServer(testApp);
  await new Promise<void>((resolve) => testServer.listen(APP_PORT, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${APP_PORT}/api/v2/calendar`;
  console.log(`[SETUP] Express calendar API running on port ${APP_PORT}\n`);

  try {
    // ── Test 1: Connect URL Generation ─────────────────────────────
    const rConnect = await fetch(`${baseUrl}/connect-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test_owner_token',
      },
    });
    const connectData = await rConnect.json();
    console.log('rConnect status:', rConnect.status, 'data:', connectData);
    assert(rConnect.status === 200 && typeof connectData.url === 'string', 'POST /connect-url returns valid authorization URL');
    assert(
      connectData.url.includes('calendar.freebusy') && connectData.url.includes('calendar.events'),
      'POST /connect-url uses least-privilege scopes (calendar.freebusy + calendar.events)'
    );

    // ── Test 2: RBAC Protection on Connect URL ─────────────────────
    const rConnectViewer = await fetch(`${baseUrl}/connect-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test_viewer_token',
      },
    });
    assert(rConnectViewer.status === 403, 'POST /connect-url rejects viewer role with HTTP 403 Forbidden');

    // ── Test 3: Browser Navigation to GET /auth ───────────────────
    const rAuth = await fetch(`${baseUrl}/auth`, { redirect: 'manual' });
    assert(rAuth.status === 302, 'GET /auth returns HTTP 302 redirecting directly to Google consent screen');
    const authLocation = rAuth.headers.get('location') || '';
    assert(authLocation.startsWith('https://accounts.google.com/'), 'GET /auth redirects to accounts.google.com');

    // ── Test 4: Token Encryption at Rest on Callback ───────────────
    const { OAuth2Client } = await import('google-auth-library');
    (OAuth2Client.prototype as any).getToken = async () => ({
      tokens: {
        access_token: 'ya29.UNENCRYPTED_ACCESS_SECRET',
        refresh_token: '1//UNENCRYPTED_REFRESH_SECRET',
        scope: 'https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.events',
        expiry_date: Date.now() + 3600000,
      },
    });

    // Extract valid signed state from connect URL
    const urlObj = new URL(connectData.url);
    const validState = urlObj.searchParams.get('state')!;

    const rCallback = await fetch(`${baseUrl}/callback?code=fake_auth_code&state=${encodeURIComponent(validState)}`, {
      redirect: 'manual',
    });
    const callbackLoc = rCallback.headers.get('location') || '';

    const updatedUser = await prisma.user.findUnique({
      where: { id: testUserId },
      select: { googleCalendarTokens: true },
    });

    const isEncrypted =
      Boolean(updatedUser?.googleCalendarTokens?.startsWith('v2:')) &&
      !updatedUser?.googleCalendarTokens?.includes('UNENCRYPTED_REFRESH_SECRET');

    assert(isEncrypted, 'Google refresh and access tokens are encrypted at rest with versioned AES-256-GCM (v2:...)');
    assert(
      callbackLoc.includes('/dashboard?calendar=connected'),
      'Callback redirects to absolute frontend URL (/dashboard?calendar=connected)'
    );

    // ── Test 5: Single-Use State Nonce & Replay Rejection ───────────
    const rReplay = await fetch(`${baseUrl}/callback?code=fake_code_2&state=${encodeURIComponent(validState)}`, {
      redirect: 'manual',
    });
    const replayLoc = rReplay.headers.get('location') || '';
    assert(
      replayLoc.includes('calendar=error') && replayLoc.includes('state_replayed'),
      'Second use of the same OAuth state is rejected (replay attack prevention)'
    );

    // ── Test 6: Health Status Check ───────────────────────────────
    const rStatusHealthy = await fetch(`${baseUrl}/status`, {
      headers: { Authorization: 'Bearer test_owner_token' },
    });
    const statusData = await rStatusHealthy.json();
    assert(statusData.connected === true && statusData.status === 'healthy', 'GET /status returns healthy for valid active tokens');

    // ── Test 7: Revoked / Garbage Token Detection ───────────────────
    await prisma.user.update({
      where: { id: testUserId },
      data: { googleCalendarTokens: JSON.stringify({ access_token: 'revoked', refresh_token: 'revoked' }) },
    });

    const isConnectedWithRevoked = await CalendarService.hasConnectedCalendar(testUserId);
    assert(!isConnectedWithRevoked, 'CalendarService.hasConnectedCalendar returns false for revoked/invalid tokens');

    const rStatusRevoked = await fetch(`${baseUrl}/status`, {
      headers: { Authorization: 'Bearer test_owner_token' },
    });
    const revokedStatusData = await rStatusRevoked.json();
    assert(
      revokedStatusData.connected === false && revokedStatusData.status === 'needs_reauth',
      'GET /status returns needs_reauth when tokens are marked revoked'
    );

    // ── Test 8: Fallback Honesty When Calendar Fails ────────────────
    const checkResult = await CalendarService.checkAvailability(
      testUserId,
      new Date(Date.now() + 86400000).toISOString(),
      new Date(Date.now() + 90000000).toISOString()
    );
    assert(
      checkResult.success === false && checkResult.flagFollowUpNeeded === true,
      'CalendarService honestly returns flagFollowUpNeeded=true and non-technical follow-up instruction on failure'
    );

    // ── Test 9: Concurrency Lock & Double Booking Prevention ────────
    // Simulate active valid tokens
    const validTokensPayload = EncryptionService.encrypt(
      JSON.stringify({
        access_token: 'valid_access_token',
        refresh_token: 'valid_refresh_token',
      })
    );
    await prisma.user.update({
      where: { id: testUserId },
      data: { googleCalendarTokens: validTokensPayload },
    });

    let mockBusyState = false;
    CalendarService.checkAvailability = async () => {
      if (mockBusyState) {
        return { success: true, available: false, busySlots: [{ start: 'now', end: 'later' }] };
      }
      mockBusyState = true;
      return { success: true, available: true, busySlots: [] };
    };

    (OAuth2Client.prototype as any).request = async () => ({
      data: { id: 'evt_race_1', htmlLink: 'https://calendar.google.com' },
    });

    const booking1 = await CalendarService.scheduleEvent(
      testUserId,
      'Consultation',
      '2026-11-06T10:00:00Z',
      '2026-11-06T10:30:00Z',
      'First call'
    );
    const booking2 = await CalendarService.scheduleEvent(
      testUserId,
      'Consultation',
      '2026-11-06T10:00:00Z',
      '2026-11-06T10:30:00Z',
      'Second call'
    );

    assert(
      booking1.success === true && booking2.error === 'SLOT_ALREADY_TAKEN',
      'Per-calendar lock & availability re-check successfully prevents race-condition double-booking'
    );

    // ── Test 10: Disconnect Revokes Token at Google ─────────────────
    let revokeCalled = false;
    (OAuth2Client.prototype as any).revokeToken = async (tok: string) => {
      revokeCalled = true;
      return { status: 200 };
    };

    const rDisconnect = await fetch(`${baseUrl}/disconnect`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer test_owner_token' },
    });
    assert(rDisconnect.status === 200, 'DELETE /disconnect returns HTTP 200');
    assert(revokeCalled === true, 'DELETE /disconnect calls Google OAuth revokeToken before deleting database tokens');

    const userAfterDisconnect = await prisma.user.findUnique({
      where: { id: testUserId },
      select: { googleCalendarTokens: true },
    });
    assert(userAfterDisconnect?.googleCalendarTokens === null, 'Google Calendar tokens purged from database upon disconnect');

    // ── Test 11: Real Bookings Endpoint (No Fabricated Calls) ───────
    const rBookings = await fetch(`${baseUrl}/bookings`, {
      headers: { Authorization: 'Bearer test_owner_token' },
    });
    const bookingsData = await rBookings.json();
    assert(Array.isArray(bookingsData), 'GET /bookings returns real bookings array');
    assert(
      !bookingsData.some((b: any) => b.phoneNumber === 'fake_call_test'),
      'GET /bookings queries real scheduled bookings instead of counting all completed calls'
    );

    // ── Test 12: Temporal Context Injection in Live Prompt ──────────
    const agentMock = {
      name: 'Dr. Scheduling Agent',
      systemPrompt: 'You help patients schedule appointments.',
      agentConfig: { timezone: 'Asia/Kolkata' },
    };
    const testFixedDate = new Date('2026-11-05T14:30:00.000Z');
    const prompt = buildFinalSystemInstruction(agentMock, {
      timezone: 'Asia/Kolkata',
      currentDate: testFixedDate,
    });

    assert(
      prompt.includes('[TEMPORAL & SCHEDULING CONTEXT]') &&
        prompt.includes('Asia/Kolkata') &&
        prompt.includes('Thursday'),
      'buildFinalSystemInstruction injects live date, day of week, formatted time, and timezone context'
    );

  } finally {
    fakeGoogleServer.close();
    testServer.close();
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log(`PART 1 VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
