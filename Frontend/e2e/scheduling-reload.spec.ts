import { test, expect } from '@playwright/test';
import { loginAsTestUser, stubBackend, ok } from './helpers/dashboard';

/**
 * Issue B6 (found in Phase 9) — the agent's Scheduling & Calendar settings reload what was saved.
 * The editor read `res.data.rule` but the client wraps bodies as `res.data.data`, so saved
 * scheduling rules never showed again (and "parse instructions" / slot preview did nothing).
 */
const AGENT = {
  id: '44444444-5555-4666-8777-888888888888', name: 'Clinic Booker', description: null, agentType: 'prompt', type: 'prompt',
  status: 'active', version: 1, workspaceId: null, model: null, voiceName: null, temperature: 0.7,
  systemPrompt: 'You book appointments for Lotus Dental.', flowGraph: null, agentConfig: '{}', languageMode: 'auto',
  direction: 'inbound', industry: 'other', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

test('saved scheduling rules show when the editor is opened again', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  await stubBackend(page, {
    [`/api/v2/calendar/rules/${AGENT.id}`]: (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, rule: { timeZone: 'Asia/Kolkata', workingDays: [1, 2, 3], workingHours: { start: '10:00', end: '16:00' }, appointmentMinutes: 45, bufferBeforeAfterMinutes: 5, minNoticeMinutes: 60, maxDaysAhead: 14, maxBookingsPerDay: 6, addMeetLink: true, instructions: '' } }),
    }),
    [`/api/v2/agents/${AGENT.id}`]: (route) => ok(route, AGENT),
    '/api/v2/agents': (route) => ok(route, [AGENT]),
  });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Edit Studio' }).click({ timeout: 30_000 });
  await page.getByRole('button', { name: /Scheduling & Calendar/ }).click();
  await expect(page.getByTestId('scheduling-duration')).toHaveValue('45');
});
