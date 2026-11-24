import { test, expect } from '@playwright/test';
import { loginAsTestUser, stubBackend, ok } from './helpers/dashboard';

/**
 * Test Call modal (RealCallModal) for a customer who has no phone number or no agent yet.
 * Before fix/real-call-modal-fallbacks it pre-selected a placeholder caller ID
 * "+918065530386 (Claritiy System Line)" and the platform owner's default agent, and told the
 * customer to dial the platform's number for inbound tests. The server refuses both for
 * customers, so every such call ended in an error. Only the customer's own numbers and agents
 * may be offered.
 */
const AGENT = { id: '55555555-6666-4777-8888-999999999999', name: 'Sales Agent', agentType: 'prompt', type: 'prompt', status: 'active', systemPrompt: 'x', agentConfig: '{}', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
const NUMBER = { id: 'n1', phoneNumber: '+918045670000', status: 'active', assignedAgentId: AGENT.id, inboundEnabled: true };
const PLATFORM_LINE = /8065530386|6553 0386|Claritiy System Line|Claritiy Voice Assistant/;

test('no phone number: the modal says so, offers no platform number, and Inbound explains what is needed', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  await stubBackend(page, {
    '/api/v2/numbers': (route) => ok(route, []),
    '/api/v2/agents/me/profile': (route) => ok(route, { id: 'u', accountType: 'starter' }),
    '/api/v2/agents': (route) => ok(route, [AGENT]),
  });
  await page.goto('/dashboard');
  await page.getByTitle('Test Real Call with this Agent').first().click({ timeout: 30_000 });

  await expect(page.getByTestId('no-number-help')).toBeVisible();
  await expect(page.getByTestId('from-number-select')).toBeDisabled();
  await expect(page.getByTestId('from-number-select')).toContainText('No phone number yet');
  await expect(page.getByTestId('agent-select')).toHaveValue(AGENT.id);
  // The server decides about the caller ID (the platform owner may call without one): the button stays usable.
  await expect(page.getByRole('button', { name: /Initiate Outbound Call Now/ })).toBeEnabled();
  expect(await page.locator('body').innerText()).not.toMatch(PLATFORM_LINE);
  await page.screenshot({ path: '../docs/proof/real-call-modal/no-number-1440.png' });

  await page.getByRole('button', { name: /Inbound/ }).first().click();
  await expect(page.getByTestId('inbound-no-number')).toContainText('No phone number yet');
  expect(await page.locator('body').innerText()).not.toMatch(PLATFORM_LINE);
});

test('no agent: the modal says to create one and the call button is disabled', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsTestUser(page);
  const posted: string[] = [];
  await stubBackend(page, {
    '/api/v2/numbers/calling-config': (route) => ok(route, [{ ...NUMBER, assignedAgentId: null }]),
    '/api/v2/numbers': (route) => ok(route, [{ ...NUMBER, assignedAgentId: null }]),
    '/api/v2/calls': (route) => { posted.push(route.request().method()); return ok(route, []); },
    '/api/v2/agents': (route) => ok(route, []),
  });
  await page.goto('/dashboard/calling');
  await page.getByRole('button', { name: 'Test Call' }).first().click({ timeout: 30_000 });

  await expect(page.getByTestId('no-agent-help')).toBeVisible();
  await expect(page.getByTestId('agent-select')).toContainText('No agents yet');
  await expect(page.getByTestId('agent-select')).toBeDisabled();
  await expect(page.getByTestId('from-number-select')).toHaveValue(NUMBER.phoneNumber);
  await expect(page.getByRole('button', { name: /Initiate Outbound Call Now/ })).toBeDisabled();
  expect(await page.locator('body').innerText()).not.toMatch(PLATFORM_LINE);
  expect(posted.filter((m) => m === 'POST')).toHaveLength(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: '../docs/proof/real-call-modal/no-agent-390.png' });

  // Inbound names the number's own agent (none here), never a platform default.
  await page.getByRole('button', { name: /Inbound/ }).first().click();
  await expect(page.getByTestId('inbound-agent-name')).toHaveText('No agent assigned to this number');
});

test('while numbers and agents load, nothing is pre-selected and the call button waits', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => { release = r; });
  let modalOpening = false;
  await stubBackend(page, {
    '/api/v2/numbers': async (route) => { if (modalOpening) await gate; return ok(route, [NUMBER]); },
    '/api/v2/agents/me/profile': (route) => ok(route, { id: 'u', accountType: 'starter' }),
    // The dashboard's own agent list answers at once; the modal's requests wait for the gate.
    '/api/v2/agents': async (route) => { if (modalOpening) await gate; return ok(route, [AGENT]); },
  });
  await page.goto('/dashboard');
  const testCall = page.getByTitle('Test Real Call with this Agent').first();
  await expect(testCall).toBeVisible({ timeout: 30_000 });
  modalOpening = true;
  await testCall.click();

  await expect(page.getByTestId('from-number-select')).toContainText('Loading your numbers');
  await expect(page.getByRole('button', { name: /Initiate Outbound Call Now/ })).toBeDisabled();
  expect(await page.locator('body').innerText()).not.toMatch(PLATFORM_LINE);

  release();
  await expect(page.getByTestId('from-number-select')).toHaveValue(NUMBER.phoneNumber);
  await expect(page.getByRole('button', { name: /Initiate Outbound Call Now/ })).toBeEnabled();
  await page.getByRole('button', { name: /Inbound/ }).first().click();
  await expect(page.getByTestId('inbound-agent-name')).toHaveText(AGENT.name);
});
