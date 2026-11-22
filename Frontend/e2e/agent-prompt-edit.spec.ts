import { test, expect } from '@playwright/test';
import { loginAsTestUser, stubBackend, ok } from './helpers/dashboard';
import { DIRECTION_TEXTS, DIRECTION_HEADER, HANDBOOK_HEADER } from '../src/app/components/agents/promptBlocks';

/**
 * Audit #158 (double audit, 2026-11-22): editing a saved agent silently lost new instructions.
 * The saved prompt carries generated [CALL DIRECTION INSTRUCTION] / [AGENT HANDBOOK INSTRUCTIONS]
 * blocks; the editor showed them, a customer typed new rules after them, and the next save cut
 * everything from the first generated header to the end — including the new rules.
 * Now the editor shows only the customer's own text and keeps it all on save.
 */
const HONEST_AI = "If asked whether you are an AI, respond honestly, e.g. 'Yes — I'm an AI assistant here to help.'";
const SAVED = `You are Priya, the receptionist of Lotus Dental.\n\n${DIRECTION_HEADER}\n${DIRECTION_TEXTS.inbound}\n\n${HANDBOOK_HEADER}\n- ${HONEST_AI}`;
const AGENT = {
  id: '55555555-6666-4777-8888-999999999999', name: 'Lotus Receptionist', description: null, agentType: 'prompt', type: 'prompt',
  status: 'active', version: 2, workspaceId: null, model: null, voiceName: null, temperature: 0.7,
  systemPrompt: SAVED, flowGraph: null, agentConfig: '{}', languageMode: 'auto',
  direction: 'inbound', industry: 'other', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

async function openEditor(page: import('@playwright/test').Page, agent: typeof AGENT) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  const seen = await stubBackend(page, {
    [`/api/v2/agents/${agent.id}`]: (route) => ok(route, agent),
    '/api/v2/agents': (route) => ok(route, [agent]),
  });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Edit Studio' }).click({ timeout: 30_000 });
  const box = page.locator('textarea').first();
  await expect(box).toBeVisible();
  return { seen, box };
}

test('#158 the editor shows only the customer\'s text, and new rules typed at the end survive Save', async ({ page }) => {
  const { seen, box } = await openEditor(page, AGENT);
  await expect(box).toHaveValue('You are Priya, the receptionist of Lotus Dental.');

  await box.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('\nAlways offer a call-back from the dentist.');
  await page.getByRole('button', { name: /^Save$/ }).click();

  await expect.poll(() => seen.find((r) => r.method === 'PUT' && r.url.includes(`/api/v2/agents/${AGENT.id}`))?.body?.systemPrompt, { timeout: 15_000 })
    .toContain('Always offer a call-back from the dentist.');
  const saved: string = seen.find((r) => r.method === 'PUT' && r.url.includes(`/api/v2/agents/${AGENT.id}`))!.body.systemPrompt;
  expect(saved.split('Always offer a call-back').length - 1).toBe(1);
  expect(saved.split(DIRECTION_HEADER).length - 1).toBe(1);
  expect(saved.indexOf('Always offer a call-back')).toBeLessThan(saved.indexOf(DIRECTION_HEADER));
});

test('#158 an agent saved by the old editor keeps text that was typed after a generated line', async ({ page }) => {
  const legacy = { ...AGENT, systemPrompt: `${SAVED} Speak slowly with older callers.` };
  const { box } = await openEditor(page, legacy);
  await expect(box).toHaveValue('You are Priya, the receptionist of Lotus Dental.\n\nSpeak slowly with older callers.');
});
