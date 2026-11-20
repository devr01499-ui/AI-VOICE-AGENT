import { test, expect } from '@playwright/test';
import { loginAsTestUser, stubBackend, ok, json } from './helpers/dashboard';

/**
 * Audit batch 10 — dashboard screens (docs/AUDIT_FINDINGS.md), against a stubbed backend:
 *  #85  the live call transcript shows the turns the server streams
 *  #87  a new search resets Call History to page 1 (no stranded empty page)
 *  #93  the Reports "Pending" filter lists the calls waiting for analysis
 *  #96  the plan badge shows the customer's plan name, not the internal key
 *  #98  picking an agent for the knowledge-base test is not undone by the background refresh
 *  #99  Publish makes the agent active
 *  #53  a saved buffer of 0 minutes shows as 0
 *  #100/#152 errors show the server's reason
 */

const AGENT = {
  id: '44444444-5555-4666-8777-999999999999', name: 'Clinic Booker', description: null, agentType: 'prompt', type: 'prompt',
  status: 'draft', version: 1, workspaceId: null, model: null, voiceName: null, temperature: 0.7,
  systemPrompt: 'You book appointments for Lotus Dental.', flowGraph: null, agentConfig: '{}', languageMode: 'auto',
  direction: 'inbound', industry: 'other', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

function call(i: number, extra: Record<string, unknown> = {}) {
  return {
    id: `aaaaaaaa-bbbb-4ccc-8ddd-${String(i).padStart(12, '0')}`,
    recipientPhoneNumber: `+9198000000${String(i).padStart(2, '0')}`,
    status: 'completed', callDirection: 'outbound', durationSeconds: 61, createdAt: new Date(Date.now() - i * 60000).toISOString(),
    agentName: 'Clinic Booker', ...extra,
  };
}

test('#87 a new search starts Call History at page 1', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  const all = Array.from({ length: 25 }, (_, i) => call(i + 1));
  await stubBackend(page, {
    '/api/v2/calls': (route) => {
      const u = new URL(route.request().url());
      if (u.pathname !== '/api/v2/calls') return ok(route, []);
      const q = u.searchParams.get('search') || '';
      return ok(route, q ? all.filter((c) => c.recipientPhoneNumber.includes(q)) : all);
    },
  });
  await page.goto('/dashboard/calls');
  await expect(page.getByText('Showing Page 1 of 3')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Showing Page 3 of 3')).toBeVisible();
  await page.getByPlaceholder('Search contact/summary…').fill('+919800000007');
  await expect(page.getByText('+919800000007').first()).toBeVisible({ timeout: 15_000 });
});

test('#85 the live transcript shows the turns the server streams', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  const live = call(1, { status: 'in_progress', durationSeconds: 0 });
  await page.routeWebSocket(/live-transcript/, (ws) => {
    setTimeout(() => {
      ws.send(JSON.stringify({ event: 'transcript', turnId: 't1', seq: 1, speaker: 'user', text: 'Is the clinic open', isFinal: false }));
      ws.send(JSON.stringify({ event: 'transcript', turnId: 't1', seq: 1, speaker: 'user', text: 'Is the clinic open on Sunday?', isFinal: true }));
      ws.send(JSON.stringify({ event: 'transcript', turnId: 't2', seq: 2, speaker: 'agent', text: 'Yes, from 10 to 2.', isFinal: true }));
    }, 300);
  });
  await stubBackend(page, {
    [`/api/v2/calls/${live.id}/transcript-ticket`]: (route) => ok(route, { ticket: 'ticket-1' }),
    [`/api/v2/calls/${live.id}/transcript`]: (route) => ok(route, { turns: [] }),
    '/api/v2/calls': (route) => ok(route, new URL(route.request().url()).pathname === '/api/v2/calls' ? [live] : []),
  });
  await page.goto('/dashboard/calls');
  await page.getByRole('button', { name: /Transcript/ }).first().click({ timeout: 30_000 });
  await expect(page.getByText('Is the clinic open on Sunday?')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Yes, from 10 to 2.')).toBeVisible();
  await expect(page.getByText('Is the clinic open', { exact: true })).toHaveCount(0); // partial replaced, not duplicated
});

test('#93 the Reports "Pending" filter lists calls waiting for analysis', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  const queued = {
    id: 'job-1', callId: call(3).id, queued: true, blueprintId: 'tpl-0', blueprintName: 'Waiting for analysis', status: 'pending',
    label: 'Queued', resultLabel: null, score: null, confidence: null, reviewNeeded: false, reviewReason: null, summary: null,
    fields: {}, evidenceQuotes: {}, hasHumanCorrection: false, reviewStatus: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    call: { id: call(3).id, recipientPhoneNumber: '+919800000003', fromPhoneNumber: '', direction: 'outbound', contactNumber: '+919800000003', businessNumber: '', status: 'completed', durationSeconds: 61, hasRecording: false, agent: { id: AGENT.id, name: AGENT.name } },
  };
  await stubBackend(page, {
    '/api/v2/reports': (route) => {
      const u = new URL(route.request().url());
      if (u.pathname !== '/api/v2/reports') return ok(route, {});
      const items = u.searchParams.get('status') === 'pending' ? [queued] : [];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items, nextCursor: null, hasMore: false, totalCount: items.length }, items, nextCursor: null, hasMore: false, totalCount: items.length }) });
    },
  });
  await page.goto('/dashboard/reports');
  await page.locator('select').filter({ has: page.locator('option[value="pending"]') }).first().selectOption('pending', { timeout: 30_000 });
  await expect(page.getByText('+919800000003').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('In queue')).toBeVisible();
});

test('#96 the plan badge shows the plan name', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  await stubBackend(page, {
    '/api/v2/agents/me/profile': (route) => ok(route, { id: 'u', email: 'owner@example.org', accountType: 'developer', callingBalanceMinutes: 120 }),
  });
  await page.goto('/dashboard/settings');
  await expect(page.getByText('Startup Plan')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/developer Plan/i)).toHaveCount(0);
});

test('#99 Publish makes the agent active; #53 a saved buffer of 0 shows as 0', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  page.on('dialog', (d) => { d.accept().catch(() => {}); });
  const seen = await stubBackend(page, {
    [`/api/v2/calendar/rules/${AGENT.id}`]: (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, rule: { timeZone: 'Asia/Kolkata', workingDays: [1, 2, 3], workingHours: { start: '10:00', end: '16:00' }, appointmentMinutes: 45, bufferBeforeAfterMinutes: 0, minNoticeMinutes: 0, maxDaysAhead: 14, maxBookingsPerDay: 6, addMeetLink: false, instructions: '' } }),
    }),
    [`/api/v2/agents/${AGENT.id}`]: (route) => ok(route, AGENT),
    '/api/v2/agents': (route) => ok(route, [AGENT]),
  });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Edit Studio' }).click({ timeout: 30_000 });
  await page.getByRole('button', { name: /Scheduling & Calendar/ }).click();
  await expect(page.getByTestId('scheduling-duration')).toHaveValue('45');
  await expect(page.locator('label:has-text("Buffer (min)") + input')).toHaveValue('0');
  await expect(page.locator('label:has-text("Min Notice (min)") + input')).toHaveValue('0');
  await page.getByRole('button', { name: 'Publish' }).first().click();
  await expect.poll(() => seen.find((r) => r.method === 'PUT' && r.url.includes(`/api/v2/agents/${AGENT.id}`))?.body?.status, { timeout: 15_000 }).toBe('active');
});

test('#98 picking an agent for the knowledge-base test survives the background refresh', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  const docs = [
    { id: 'kb-1', name: 'Price list.pdf', status: 'ready', progress: 100, sizeChars: 4200, agentIds: [], createdAt: new Date().toISOString() },
    { id: 'kb-2', name: 'Doctors.pdf', status: 'processing', progress: 40, sizeChars: 3000, agentIds: [], createdAt: new Date().toISOString() },
  ];
  let listCalls = 0;
  await stubBackend(page, {
    '/api/v2/knowledge-base/limits': (route) => ok(route, {
      limits: { maxDocuments: 10, maxStorageMb: 25, maxFileSizeMb: 10, maxChunksPerWorkspace: 1500, maxKbAttachedPerAgent: 3 },
      usage: { documents: 2, storageMb: 0.4, chunks: 30 },
      supportedFileTypes: ['.pdf', '.txt', '.csv', '.md'],
    }),
    '/api/v2/knowledge-base': (route) => { if (new URL(route.request().url()).pathname === '/api/v2/knowledge-base') listCalls++; return ok(route, docs); },
    '/api/v2/agents': (route) => ok(route, [{ ...AGENT, status: 'active' }]),
  });
  await page.goto('/dashboard/knowledge');
  await expect(page.getByText('Knowledge Base & RAG v2')).toBeVisible({ timeout: 30_000 });
  const docSelect = page.locator('label:has-text("TARGET DOCUMENT") + select');
  const agentSelect = page.locator('label:has-text("OR TARGET AGENT") + select');
  await expect(docSelect).toHaveValue('kb-1', { timeout: 30_000 });
  await agentSelect.selectOption(AGENT.id);
  const before = listCalls;
  // A list reload (Refresh button, a new upload, or the indexing poll) must not switch the test back to document #1.
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect.poll(() => listCalls, { timeout: 12_000 }).toBeGreaterThan(before);
  await page.waitForTimeout(300);
  await expect(agentSelect).toHaveValue(AGENT.id);
  await expect(docSelect).toHaveValue('');
});

test('#152/#100 alert-rule errors show the server reason', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  const messages: string[] = [];
  page.on('dialog', (d) => { messages.push(d.message()); d.accept(); });
  await stubBackend(page, {
    '/api/v2/alerting/rules': (route) => route.request().method() === 'POST'
      ? json(route, 400, { success: false, error: 'evaluationWindowMins must be a whole number from 1 to 43200 (30 days).' })
      : ok(route, []),
    '/api/v2/alerting/incidents': (route) => ok(route, []),
  });
  await page.goto('/dashboard/alerting');
  await page.getByRole('button', { name: /Create Alert Rule/ }).first().click({ timeout: 30_000 });
  await page.getByPlaceholder('e.g. High Error Rate Alert (>15%)').fill('Errors');
  await page.getByRole('button', { name: /Save Rule/ }).click();
  await expect.poll(() => messages.join(' | '), { timeout: 10_000 }).toContain('evaluationWindowMins must be a whole number');
});

test('proof screenshots: queued reports, plan badge, scheduled calls on the calendar (1440 / 390)', async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsTestUser(page);
  const at = new Date(Date.now() + 2 * 86400000).toISOString();
  await stubBackend(page, {
    '/api/v2/agents/me/profile': (route) => ok(route, { id: 'u', email: 'owner@example.org', accountType: 'professional', callingBalanceMinutes: 950 }),
    '/api/v2/calendar/bookings': (route) => ok(route, [
      { id: 'appt-1', kind: 'appointment', source: 'ai_booked', callerName: 'Asha', phoneNumber: '+919876543210', scheduledAtUtc: at, timezone: 'Asia/Kolkata', status: 'confirmed', notes: 'Cleaning appointment' },
      { id: 'sc-1', kind: 'scheduled_call', source: 'ai_booked', phoneNumber: '+919876543211', scheduledAtUtc: at, timezone: 'Asia/Kolkata', status: 'scheduled', notes: 'Call back about the quote' },
    ]),
    '/api/v2/reports': (route) => {
      const u = new URL(route.request().url());
      if (u.pathname !== '/api/v2/reports') return ok(route, {});
      const items = u.searchParams.get('status') === 'pending' ? [{
        id: 'job-1', callId: 'c-1', queued: true, blueprintId: 'tpl-0', blueprintName: 'Waiting for analysis', status: 'pending', label: 'Queued',
        resultLabel: null, score: null, confidence: null, reviewNeeded: false, reviewReason: null, summary: null, fields: {}, evidenceQuotes: {},
        hasHumanCorrection: false, reviewStatus: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        call: { id: 'c-1', recipientPhoneNumber: '+919800000003', fromPhoneNumber: '', direction: 'outbound', contactNumber: '+919800000003', businessNumber: '', status: 'completed', durationSeconds: 61, hasRecording: false, agent: { id: 'a', name: 'Clinic Booker' } },
      }] : [];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items, nextCursor: null, hasMore: false, totalCount: items.length } }) });
    },
  });
  for (const vp of [{ name: '1440', width: 1440, height: 900 }, { name: '390', width: 390, height: 844 }]) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/dashboard/reports');
    await page.locator('select').filter({ has: page.locator('option[value="pending"]') }).first().selectOption('pending', { timeout: 30_000 });
    await expect(page.getByText('In queue').first()).toBeAttached({ timeout: 15_000 });
    await page.screenshot({ path: `../docs/proof/audit-batch10-reports-queued-${vp.name}.png` });
    await page.goto('/dashboard/settings');
    await expect(page.getByText('Growth Plan')).toBeVisible({ timeout: 30_000 });
    await page.getByText('Growth Plan').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `../docs/proof/audit-batch10-plan-badge-${vp.name}.png` });
    await page.goto('/dashboard/calendar');
    await expect(page.getByText('AI Follow-up Call')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Cancel call' })).toBeVisible();
    await page.screenshot({ path: `../docs/proof/audit-batch10-calendar-${vp.name}.png` });
  }
});
