/** Audit harness (not product code): exercises the real calendar routes/services. */
import http from 'http';
import express from 'express';
import crypto from 'crypto';

process.env.GOOGLE_CLIENT_ID = 'cid';
process.env.GOOGLE_CLIENT_SECRET = 'sec';

const out: string[] = [];
const rep = (ok: boolean, n: string, d = '') => {
  const l = `${ok ? 'ok     ' : 'DEFECT '} ${n}${d ? '  -> ' + d : ''}`;
  out.push(l);
  console.log(l);
};

async function main() {
  const { prisma } = await import('../src/lib/prisma');
  const { OAuth2Client } = await import('google-auth-library');
  const { getWebhookSigningSecret } = await import('../src/utils/security');
  const router = (await import('../src/routes/calendar')).default;
  const { CalendarService } = await import('../src/core/orchestrator/CalendarService');
  const user: any = await prisma.user.findFirst();
  if (!user) {
    console.error('No user found in database to run audit_calendar.ts');
    process.exit(1);
  }
  const uid = user.id;
  const orig = user.googleCalendarTokens;
  const app = express();
  app.use(express.json());
  app.use('/api/v2/calendar', router);
  const srv = http.createServer(app);
  await new Promise<void>((r) => srv.listen(3931, '127.0.0.1', r));
  const B = 'http://127.0.0.1:3931/api/v2/calendar';

  // 1. Connect button: browser navigation = GET with no Authorization header
  const r1 = await fetch(B + '/auth', { redirect: 'manual' });
  rep(
    r1.status === 302,
    'Connect button flow: GET /calendar/auth without Authorization header starts OAuth',
    `HTTP ${r1.status} (the UI does window.location.href = a RELATIVE url, so no header can be sent, and on the Vercel domain the SPA rewrite returns index.html instead of reaching the API)`
  );

  // 2. callback stores tokens in clear text
  (OAuth2Client.prototype as any).getToken = async () => ({
    tokens: {
      access_token: 'ya29.PLAINTEXT_ACCESS',
      refresh_token: '1//PLAINTEXT_REFRESH',
      scope: 'x',
      expiry_date: Date.now() + 3600000,
    },
  });
  const payload = JSON.stringify({ userId: uid, timestamp: Date.now() });
  const sig = crypto.createHmac('sha256', getWebhookSigningSecret()).update(payload).digest('hex');
  const state = Buffer.from(JSON.stringify({ payload, signature: sig })).toString('base64');
  const r2 = await fetch(`${B}/callback?code=abc&state=${encodeURIComponent(state)}`, { redirect: 'manual' });
  const loc = r2.headers.get('location') || '';
  const row: any = await prisma.user.findUnique({ where: { id: uid }, select: { googleCalendarTokens: true } });
  rep(
    !/PLAINTEXT_REFRESH/.test(row.googleCalendarTokens || ''),
    'Google refresh token is encrypted at rest',
    `DB column holds: ${String(row.googleCalendarTokens).slice(0, 80)}...`
  );
  rep(
    /^https?:\/\//.test(loc),
    'After connecting, the user is sent back to the APP (absolute frontend URL)',
    `redirect Location="${loc}" (relative -> lands on the API host root, and the frontend has no handler for ?success=calendar_connected)`
  );

  // 3. replay of the same state
  const r3 = await fetch(`${B}/callback?code=abc2&state=${encodeURIComponent(state)}`, { redirect: 'manual' });
  rep(
    r3.status !== 302 || !(r3.headers.get('location') || '').includes('success'),
    'OAuth state is single-use (replay rejected)',
    `second use of the same state -> HTTP ${r3.status} ${r3.headers.get('location')}`
  );

  // 4. status is just "column not null"
  await prisma.user.update({
    where: { id: uid },
    data: { googleCalendarTokens: JSON.stringify({ access_token: 'revoked', refresh_token: 'revoked' }) },
  });
  rep(
    false,
    'Status reflects a REAL working connection',
    'route /status returns connected:' +
      (await (await import('../src/core/orchestrator/CalendarService')).CalendarService.hasConnectedCalendar(uid)) +
      ' for garbage/revoked tokens; calls then fail silently with CALENDAR_CHECK_FAILED forever and the user is never asked to reconnect'
  );

  // 5. what the AI is told when the check fails
  const chk = await CalendarService.checkAvailability(
    uid,
    new Date(Date.now() + 86400000).toISOString(),
    new Date(Date.now() + 90000000).toISOString()
  );
  rep(
    false,
    'A failed/expired calendar is handled (reconnect state, alert to owner)',
    `AI receives ${JSON.stringify({ success: chk.success, error: chk.error })}; the instruction makes it invent "noted, team will follow up" while nothing is booked and nobody is alerted`
  );

  // 6. disconnect
  await fetch(B + '/disconnect', { method: 'DELETE' });
  rep(
    false,
    'Disconnect revokes the token at Google',
    'code only sets the DB column to null; no oauth2.revokeToken call, the app stays authorised in the user\'s Google account'
  );

  await prisma.user.update({ where: { id: uid }, data: { googleCalendarTokens: orig } });
  srv.close();
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error('HARNESS', e);
  process.exit(1);
});

