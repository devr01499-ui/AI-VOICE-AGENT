import { test, expect, type Route } from '@playwright/test';
import { loginAsTestUser, TEST_USER } from './helpers/dashboard';

/**
 * Phase 14 (CLAUDE.md §8) — end-to-end smoke journey through the real UI:
 * sign up → (verified) sign in → create an agent → buy a plan (test-mode checkout) → claim the
 * number (simulated carrier) → place a test call → see it in Call History and play its recording
 * → sign out.
 *
 * Every request that leaves the dev server is answered by the stateful fake backend below, so the
 * journey never reaches the real API, Supabase, Razorpay or a carrier. The server side of every
 * step is proven separately against a real test database by the server suites named next to each
 * step (npm run test:security). Live carrier calls and a real Razorpay test payment are owner steps.
 */

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const ok = (route: Route, data: unknown) => json(route, 200, { success: true, data });

const AGENT_ID = '22222222-2222-4222-8222-222222222222';
const NUMBER = { id: 'num-1', phoneNumber: '+918045671234', label: 'Main line', type: 'local', region: 'Bengaluru', status: 'active', kycStatus: 'verified', telephonyProvider: 'vobiz', assignedAgentId: AGENT_ID };

test('smoke: sign up → agent → plan → number → call → history + recording → sign out', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  // ── Fake backend state ──
  const state = {
    agents: [] as any[],
    plan: 'free' as string,
    numbers: [] as any[],
    calls: [] as any[],
  };
  const seen: { url: string; method: string; body: any }[] = [];
  const dialogs: string[] = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.accept().catch(() => {}); });

  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, async (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();
    let body: any = null;
    try { body = req.postDataJSON(); } catch { body = req.postData(); }
    seen.push({ url, method, body });
    const path = new URL(url).pathname;

    // Sign-up (server pre-check, consent, Supabase account) — server side: test_signup_public_routes, test_security_hardening (consent)
    if (path.endsWith('/api/v2/user/validate-signup')) return ok(route, { normalizedEmail: String(body.email).trim().toLowerCase(), normalizedContactNumber: '+919876543210', valid: true });
    if (path.endsWith('/api/v2/user/consent')) return ok(route, { recorded: true });
    if (path.endsWith('/auth/v1/signup')) return json(route, 200, { id: TEST_USER.id, aud: 'authenticated', email: body.email, user_metadata: body.data, app_metadata: {}, identities: [], created_at: new Date().toISOString() });
    if (path.endsWith('/auth/v1/user')) return json(route, 200, { id: TEST_USER.id, email: TEST_USER.email, aud: 'authenticated', user_metadata: { full_name: TEST_USER.fullName } });
    if (path.endsWith('/auth/v1/logout')) return route.fulfill({ status: 204, body: '' });

    // Agents — server side: test_agent_config_integrity, test_flow_agent_instructions
    if (path.endsWith('/api/v2/agents/me/profile')) return ok(route, { id: TEST_USER.id, email: TEST_USER.email, fullName: TEST_USER.fullName, accountType: state.plan, callingBalanceMinutes: state.plan === 'free' ? 0 : 750, hasConsentedTerms: true });
    if (path.endsWith('/api/v2/agents') && method === 'POST') {
      const agent = { ...body, id: AGENT_ID, status: 'active', agentType: 'prompt', name: body?.name || 'Single-Prompt Agent', createdAt: new Date().toISOString() };
      state.agents = [agent];
      return ok(route, agent);
    }
    if (path.endsWith('/api/v2/agents')) return ok(route, state.agents);

    // Plan checkout — server side: test_billing_verification (21), test_payment_gateway_security
    if (path.endsWith('/api/v2/billing/create-plan-order')) return ok(route, { id: 'order_test_1', orderId: 'order_test_1', amount: 379900, currency: 'INR', keyId: 'rzp_test_public' });
    if (path.endsWith('/api/v2/billing/verify-plan')) { state.plan = 'startup'; return ok(route, { message: 'Plan purchased successfully.', plan: 'startup', planName: 'Startup', alreadyActive: false }); }

    // Number (simulated carrier) — server side: test_number_entitlement (9), test_security_hardening (agent ownership)
    if (path.endsWith('/api/v2/numbers/status')) return ok(route, { numberLocked: state.numbers.length > 0, number: state.numbers[0]?.phoneNumber || null });
    if (path.endsWith('/api/v2/kyc/status')) return ok(route, { isVerified: true, kycStatus: 'verified' });
    if (path.endsWith('/api/v2/numbers/search')) return ok(route, { results: [{ id: 'inv-1', e164: NUMBER.phoneNumber, region: NUMBER.region, country: 'IN', capabilities: { voice: true, sms: false }, aadhaar_verification_required: false }], total: 1, hasMore: false });
    if (path.endsWith('/api/v2/numbers/claim')) { state.numbers = [NUMBER]; return ok(route, { phoneNumberId: NUMBER.id, number: NUMBER.phoneNumber, status: 'active' }); }
    if (path.endsWith('/api/v2/numbers')) return ok(route, state.numbers);

    // Calls — server side: test_call_limits, test_caller_id_fallback, test_security_hardening (tenant + toll-fraud)
    if (path.endsWith('/api/v2/calls') && method === 'POST') {
      const call = { id: 'call-smoke-1', callId: 'call-smoke-1', status: 'completed', callDirection: 'outbound', direction: 'outbound', recipientPhoneNumber: '+919812345678', contactNumber: '+919812345678', fromPhoneNumber: NUMBER.phoneNumber, agentName: 'Single-Prompt Agent', durationSeconds: 65, billedMinutes: 2, hasRecording: true, recordingUrl: null, hasTranscript: true, summary: 'Smoke test call.', createdAt: new Date().toISOString(), startedAt: new Date().toISOString() };
      state.calls = [call];
      return ok(route, { callId: call.id, id: call.id, status: 'queued' });
    }
    if (/\/api\/v2\/calls\/[^/]+\/transcript-ticket$/.test(path)) return ok(route, { ticket: 'ticket-smoke' });
    // Recording — server side: test_recording (8)
    if (/\/api\/v2\/calls\/[^/]+\/recording-link$/.test(path)) return ok(route, { url: '/api/v2/recordings/call-smoke-1/stream?u=user&e=1&s=sig', downloadUrl: '/api/v2/recordings/call-smoke-1/stream?u=user&e=1&s=sig&download=1', expiresAt: new Date(Date.now() + 300000).toISOString() });
    if (path.includes('/api/v2/recordings/')) return route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.alloc(0) });
    if (/\/api\/v2\/calls\/[^/]+\/transcript$/.test(path)) return ok(route, []);
    if (path.endsWith('/api/v2/calls')) return ok(route, state.calls);

    if (path.endsWith('.js')) return route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
    if (path.includes('/api/')) return ok(route, []);
    return json(route, 200, {});
  });

  // ── 1. Sign up ──
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: /Create Workspace/ })).toBeVisible({ timeout: 30_000 });
  await page.getByPlaceholder('e.g. John Doe').fill('Asha Verma');
  await page.getByPlaceholder('+91 98765 43210').fill('98765 43210');
  await page.getByPlaceholder('you@company.com').fill('Asha.Verma@Example.org');
  await page.getByPlaceholder('••••••••••').fill('Str0ngPass99');
  await page.getByRole('button', { name: /Create Account/ }).click();
  await page.locator('label', { hasText: 'Terms and Conditions' }).getByRole('checkbox').check();
  await page.locator('label', { hasText: 'explicit consent' }).getByRole('checkbox').check();
  await page.getByRole('button', { name: /I Agree & Create Account/ }).click();
  await expect(page.getByText(/verification link has been sent/i)).toBeVisible();
  expect(seen.findIndex((r) => r.url.includes('validate-signup'))).toBeLessThan(seen.findIndex((r) => r.url.includes('/auth/v1/signup')));

  // ── 2. The verified customer signs in (email link clicked) ──
  await loginAsTestUser(page);
  await page.addInitScript(() => localStorage.setItem('token', 'test-session-token'));
  await page.goto('/dashboard');

  // ── 3. Create an agent ──
  await page.getByRole('button', { name: 'Create an Agent' }).click({ timeout: 30_000 });
  const dialog = page.getByTestId('create-agent-dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Create agent', exact: true }).click();
  await page.getByRole('button', { name: 'Publish', exact: true }).click({ timeout: 30_000 });
  await expect.poll(() => dialogs.some((m) => /published to database/i.test(m))).toBe(true);
  const created = seen.find((r) => r.method === 'POST' && new URL(r.url).pathname.endsWith('/api/v2/agents'));
  expect(created?.body?.systemPrompt, 'the agent is saved with its prompt').toBeTruthy();
  await expect(page.getByText('Single Prompt').first()).toBeVisible({ timeout: 15_000 });

  // ── 4. Buy a plan (test-mode checkout; success only after the server verifies) ──
  await page.addInitScript(() => {
    (window as any).Razorpay = function (opts: any) {
      return { on() {}, open() { setTimeout(() => opts.handler({ razorpay_order_id: opts.order_id, razorpay_payment_id: 'pay_test_1', razorpay_signature: 'sig_from_widget' }), 10); } };
    };
  });
  await page.goto('/dashboard/billing');
  await page.getByRole('button', { name: 'Purchase Startup Plan' }).click({ timeout: 30_000 });
  await expect.poll(() => dialogs.some((m) => /upgraded to the Startup Plan/.test(m))).toBe(true);
  expect(seen.find((r) => r.url.includes('/create-plan-order'))?.body).toEqual({ planName: 'Startup' });

  // ── 5. Claim the plan's number (simulated carrier) ──
  // The app reloads the page right after the purchase-success alert; do not race that reload.
  for (let attempt = 0; ; attempt++) {
    try { await page.goto('/dashboard/numbers'); break; } catch (e) {
      if (attempt >= 2 || !/interrupted by another navigation/.test(String(e))) throw e;
      await page.waitForLoadState('load');
    }
  }
  await expect(page.getByText("You haven't provisioned any numbers yet")).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Buy number' }).first().click();
  await page.locator('#select-btn-inv-1').click({ timeout: 30_000 });
  await page.locator('#confirm-permanent-checkbox').check();
  await page.locator('#confirm-claim-btn').click();
  await expect(page.getByText('Number Secured!')).toBeVisible({ timeout: 15_000 });
  const claim = seen.find((r) => r.url.includes('/api/v2/numbers/claim'));
  expect(claim?.body).toMatchObject({ vobizNumberId: 'inv-1' });
  expect(JSON.stringify(claim?.body)).not.toMatch(/price|amount/i);
  await page.locator('#go-to-numbers-btn').click();
  await expect(page.getByText(NUMBER.phoneNumber).first()).toBeVisible({ timeout: 15_000 });

  // ── 6. Place a test call ──
  await page.getByRole('button', { name: 'Call', exact: true }).first().click();
  await expect(page.getByText('Real-Time Telephony Call Testing')).toBeVisible({ timeout: 15_000 });
  await page.getByPlaceholder('+91 98765 43210').fill('+91 98123 45678');
  await page.getByRole('button', { name: /Initiate Outbound Call Now/ }).click();
  await expect(page.getByText(/Ringing Phone/)).toBeVisible({ timeout: 15_000 });
  const dial = seen.find((r) => r.method === 'POST' && new URL(r.url).pathname.endsWith('/api/v2/calls'));
  expect(dial?.body).toMatchObject({ agentId: AGENT_ID });
  expect(String(dial?.body?.phoneNumber).replace(/\D/g, '')).toBe('919812345678');

  // ── 7. Call History shows the call; its recording plays through a short-lived link ──
  await page.goto('/dashboard/calls');
  await expect(page.getByText('+919812345678').first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Transcript/ }).first().click();
  const player = page.getByTestId('recording-player');
  await expect(player).toBeVisible();
  await player.getByRole('button', { name: /Play recording/ }).click();
  await expect(player.locator('audio')).toHaveAttribute('src', /\/api\/v2\/recordings\/call-smoke-1\/stream\?/);

  // ── 8. Sign out (close the call detail panel first: its backdrop covers the sidebar) ──
  await page.locator('div.absolute.inset-0.backdrop-blur-md').first().click({ position: { x: 5, y: 5 } });
  await expect(player).toBeHidden();
  await page.getByTitle('Sign Out').click();
  await expect(page.getByRole('link', { name: /Join Now/ }).or(page.getByRole('button', { name: /Join Now/ })).first()).toBeVisible({ timeout: 15_000 });
  expect(await page.evaluate(() => localStorage.getItem('claritiy_voice_supabase_auth_token'))).toBeNull();

  // White-label: no carrier name ever reached the screen.
  expect(await page.locator('body').innerText()).not.toMatch(/vobiz|plivo/i);
});
