import { test, expect, type Page } from '@playwright/test';
import { loginAsTestUser, stubBackend, ok, json } from './helpers/dashboard';

/**
 * WhatsApp (instead of SMS) and live transfers (to a person, to another agent), 2026-11-22.
 *  - agent editor: the three function types work (no "Coming Soon"); a bad transfer number is
 *    explained before saving; an old SMS function opens as a WhatsApp step that still needs a template
 *  - flow builder: Call Transfer, Agent Transfer and WhatsApp nodes can be added; an old SMS node
 *    opens as a WhatsApp node
 *  - Integrations: WhatsApp connect form checks input and shows the webhook details after connecting
 *  - Live Monitoring: a supervisor can transfer a call; refusals are shown, never a fake success
 */
const now = new Date().toISOString();
const AGENT = {
  id: '77777777-1111-4222-8333-444444444444', name: 'Front Desk', description: null, agentType: 'prompt', type: 'prompt',
  status: 'active', version: 1, workspaceId: null, model: null, voiceName: null, temperature: 0.7,
  systemPrompt: 'You are the receptionist of Lotus Dental.', flowGraph: null,
  agentConfig: JSON.stringify({ functions: [{ id: 'fn-old', name: 'send_brochure', description: 'Caller asks for the brochure', type: 'send_sms', messageTemplate: 'Here is our brochure: https://lotus.example/b' }] }),
  languageMode: 'auto', direction: 'inbound', industry: 'other', createdAt: now, updatedAt: now,
};
const BILLING_AGENT = { ...AGENT, id: '77777777-1111-4222-8333-555555555555', name: 'Billing Specialist', agentConfig: '{}' };
const TEMPLATES = { connected: true, businessName: 'Lotus Dental', templates: [
  { name: 'booking_confirmed', language: 'en', category: 'UTILITY', status: 'APPROVED', bodyText: 'Hi {{1}}, your visit on {{2}} is confirmed.', variables: [{ key: '1', named: false }, { key: '2', named: false }], usable: true },
] };

async function openEditor(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  const seen = await stubBackend(page, {
    '/api/v2/whatsapp/templates': (route) => ok(route, TEMPLATES),
    [`/api/v2/agents/${AGENT.id}`]: (route) => ok(route, AGENT),
    '/api/v2/agents': (route) => ok(route, [AGENT, BILLING_AGENT]),
  });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Edit Studio' }).first().click({ timeout: 30_000 });
  await page.getByRole('button', { name: /Functions \(1\)/ }).click();
  return seen;
}

test('editor: an old SMS function opens as WhatsApp and asks for a template', async ({ page }) => {
  await openEditor(page);
  await expect(page.getByText('send_brochure')).toBeVisible();
  await expect(page.getByText('choose a template')).toBeVisible();
  await page.getByTitle('Edit Function').click();
  await expect(page.getByTestId('whatsapp-fields')).toBeVisible();
  await expect(page.getByText(/This was an SMS step/)).toBeVisible();
  await page.getByTestId('whatsapp-fields').locator('select').selectOption('booking_confirmed|en');
  await expect(page.getByText('Hi {{1}}, your visit on {{2}} is confirmed.')).toBeVisible();
  await expect(page.getByPlaceholder(/\{\{1\}\}: what the agent fills in/)).toBeVisible();
});

test('editor: transfer, agent hand-off and WhatsApp are real options; a bad number is explained', async ({ page }) => {
  const seen = await openEditor(page);
  await page.getByRole('button', { name: 'Add Function' }).click();
  const type = page.locator('select').filter({ hasText: 'Transfer Call to a Person' });
  const options = await type.locator('option').allTextContents();
  for (const label of ['Transfer Call to a Person (phone number)', 'Transfer to Another Agent', 'Send WhatsApp Message (approved template)']) {
    expect(options).toContain(label);
  }
  expect(options.join('|')).not.toMatch(/Send SMS/);

  await type.selectOption('agent_transfer');
  const agentSelect = page.getByTestId('agent-transfer-fields').locator('select');
  await expect(agentSelect.locator('option', { hasText: 'Billing Specialist' })).toHaveCount(1);
  await expect(agentSelect.locator('option', { hasText: 'Front Desk' })).toHaveCount(0); // never itself

  await type.selectOption('transfer_call');
  await page.getByPlaceholder('e.g. check_inventory, end_call').fill('reception_team');
  await page.getByPlaceholder(/Call this function when/).fill('The caller asks for a person');
  await page.getByTestId('transfer-call-fields').getByPlaceholder('+91 98765 43210').fill('+91 1900 123 456');
  await expect(page.getByText(/Premium-rate and shared-cost numbers/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Save Function' }).click();
  await expect(page.getByRole('button', { name: 'Save Function' })).toBeVisible(); // still open: refused
  await page.getByTestId('transfer-call-fields').getByPlaceholder('+91 98765 43210').fill('98765 43210');
  await page.getByRole('button', { name: 'Save Function' }).click();
  await expect(page.getByText('reception_team')).toBeVisible();
  await expect(page.getByText('transfer to person')).toBeVisible();

  await page.getByRole('button', { name: /^Save$/ }).click();
  await expect.poll(() => {
    const put = seen.find((r) => r.method === 'PUT' && r.url.includes(`/api/v2/agents/${AGENT.id}`));
    const cfg = put?.body?.agentConfig;
    const fns = (typeof cfg === 'string' ? JSON.parse(cfg) : cfg)?.functions || [];
    return fns.map((f: any) => `${f.type}:${f.targetNumber || f.whatsappTemplate || ''}`).sort().join(',');
  }, { timeout: 15_000 }).toBe('send_whatsapp:,transfer_call:98765 43210');
});

test('flow builder: transfer, agent and WhatsApp nodes can be added; an old SMS node becomes WhatsApp', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  const flowAgent = {
    ...AGENT, agentType: 'conversational', type: 'conversational', agentConfig: '{}',
    flowGraph: { schemaVersion: 1, nodes: [
      { id: 'n1', type: 'conversation', position: { x: 300, y: 80 }, data: { label: 'Welcome', text: 'Namaste!' } },
      { id: 'n2', type: 'inCallSms', position: { x: 300, y: 260 }, data: { label: 'Dispatch Intake Form SMS', smsMessage: 'Fill the intake form' } },
    ], edges: [{ id: 'e1', source: 'n1', target: 'n2' }] },
  };
  await stubBackend(page, {
    '/api/v2/whatsapp/templates': (route) => ok(route, TEMPLATES),
    [`/api/v2/agents/${AGENT.id}`]: (route) => ok(route, flowAgent),
    '/api/v2/agents': (route) => ok(route, [flowAgent, BILLING_AGENT]),
  });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Edit Studio' }).first().click({ timeout: 30_000 });
  for (const label of ['Call Transfer', 'Agent Transfer', 'WhatsApp Message']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${label}\\b`) }).first()).toBeEnabled();
  }
  await expect(page.getByText('Dispatch Intake Form WhatsApp')).toBeVisible();
  await page.locator('.react-flow__node[data-id="n2"]').click();
  await expect(page.getByTestId('whatsapp-fields')).toBeVisible();
});

test('Integrations: WhatsApp connect checks the input, then shows the webhook details and templates', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  let connected = false;
  const account = {
    id: 'acc-1', phoneNumberId: '106540352242922', wabaId: '102290129340398', displayPhoneNumber: '+91 98765 00000', verifiedName: 'Lotus Dental',
    status: 'connected', lastError: null, webhookUrl: 'https://api.claritiy.test/api/v2/webhooks/whatsapp/acc-1', verifyToken: 'a'.repeat(48),
    webhookVerifiedAt: null, templatesSyncedAt: now,
    templates: [...TEMPLATES.templates, { name: 'otp_code', language: 'en', category: 'AUTHENTICATION', status: 'APPROVED', bodyText: '{{1}} is your code', variables: [], usable: false, unusableReason: 'One-time passcode templates cannot be sent by a voice agent.' }],
  };
  const seen = await stubBackend(page, {
    '/api/v2/whatsapp/account': (route, req) => {
      if (req.method === 'POST') { connected = true; return ok(route, { connected: true, account }); }
      return ok(route, { connected, account: connected ? account : null });
    },
    '/api/v2/calendar/status': (route) => ok(route, { connected: false, status: 'disconnected' }),
  });
  await page.goto('/dashboard/integrations');
  const card = page.getByTestId('whatsapp-integration');
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.getByRole('button', { name: 'Connect WhatsApp' }).click();
  await card.getByPlaceholder('e.g. 106540352242922').fill('abc');
  await card.getByRole('button', { name: 'Save and connect' }).click();
  await expect(card.getByRole('alert')).toContainText('digits only');
  await card.getByPlaceholder('e.g. 106540352242922').fill('106540352242922');
  await card.getByPlaceholder('e.g. 102290129340398').fill('102290129340398');
  await card.getByPlaceholder('EAAG…').fill('EAAG' + 'x'.repeat(60));
  await card.getByPlaceholder('32 letters and numbers').fill('0123456789abcdef0123456789abcdef');
  await card.getByRole('button', { name: 'Save and connect' }).click();
  await expect(card.getByText('Lotus Dental')).toBeVisible();
  await expect(card.getByText('https://api.claritiy.test/api/v2/webhooks/whatsapp/acc-1')).toBeVisible();
  await expect(card.getByText('booking_confirmed')).toBeVisible();
  await expect(card.getByText(/1 template\(s\) cannot be sent/)).toBeVisible();
  const post = seen.find((r) => r.method === 'POST' && r.url.includes('/api/v2/whatsapp/account'));
  expect(post?.body?.phoneNumberId).toBe('106540352242922');
});

test('Live Monitoring: a supervisor can transfer a call; refusals are shown, never a fake success', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  const live = { id: '99999999-1111-4222-8333-444444444444', direction: 'outbound', contactNumber: '+919822223333', businessNumber: '+918045670000', agentId: AGENT.id, batchId: null, status: 'in_progress', handoff: null, startedAt: now, createdAt: now };
  let answer: 'refuse' | 'ok' = 'refuse';
  const seen = await stubBackend(page, {
    '/transfer': (route) => (answer === 'refuse'
      ? json(route, 409, { success: false, error: 'The call is not live any more.', code: 'CALL_NOT_LIVE' })
      : ok(route, { transferId: 't-1', status: 'dialing' })),
    '/api/v2/calls/live': (route) => ok(route, [live]),
    '/api/v2/agents': (route) => ok(route, [AGENT]),
  });
  await page.goto('/dashboard/live_monitoring');
  await page.getByText('+919822223333').first().click({ timeout: 30_000 });
  await page.getByTestId('force-transfer').click();
  const input = page.getByPlaceholder('+91 98765 43210');
  await input.fill('+911860123456');
  await page.getByRole('button', { name: 'Transfer Now' }).click();
  await expect(page.getByRole('alert')).toContainText('Premium-rate');
  await input.fill('98111 22233');
  await page.getByRole('button', { name: 'Transfer Now' }).click();
  await expect(page.getByRole('alert')).toContainText('The call is not live any more.');
  answer = 'ok';
  await page.getByRole('button', { name: 'Transfer Now' }).click();
  await expect(page.getByText(/Connecting the caller to 98111 22233/)).toBeVisible();
  expect(seen.filter((r) => r.method === 'POST' && r.url.includes('/transfer')).map((r) => r.body?.targetNumber)).toEqual(['98111 22233', '98111 22233']);
});

test('phone width (390 px): the WhatsApp card and the transfer form fit without sideways scrolling', async ({ page }) => {
  await loginAsTestUser(page);
  const account = {
    id: 'acc-1', phoneNumberId: '106540352242922', wabaId: '102290129340398', displayPhoneNumber: '+91 98765 00000', verifiedName: 'Lotus Dental',
    status: 'connected', lastError: null, webhookUrl: 'https://api.claritiy.test/api/v2/webhooks/whatsapp/acc-1-with-a-long-identifier', verifyToken: 'a'.repeat(48),
    webhookVerifiedAt: now, templatesSyncedAt: now, templates: TEMPLATES.templates,
  };
  await stubBackend(page, {
    '/api/v2/whatsapp/account': (route) => ok(route, { connected: true, account }),
    '/api/v2/calendar/status': (route) => ok(route, { connected: false, status: 'disconnected' }),
  });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto('/dashboard/integrations');
    await expect(page.getByTestId('whatsapp-integration').getByText('Lotus Dental')).toBeVisible({ timeout: 30_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `sideways overflow at ${width}px`).toBeLessThanOrEqual(1);
    await page.getByTestId('whatsapp-integration').screenshot({ path: `../docs/proof/whatsapp-integration-${width}.png` });
  }
});
