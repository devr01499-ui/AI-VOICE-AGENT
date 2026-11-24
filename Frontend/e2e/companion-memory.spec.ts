import { test, expect } from '@playwright/test';
import { loginAsTestUser, stubBackend, ok } from './helpers/dashboard';

/**
 * AI Companion voice call (DashCompanionCall). The page promises "strong memory": every chat
 * request must carry the conversation so far. Before fix/companion-memory the speech handler was
 * the first render's copy, so every request sent `history: []` and the companion forgot each turn.
 * The browser's speech recognition and speech synthesis are replaced by scripted fakes.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as any;
    class FakeRecognition {
      continuous = false; interimResults = false; lang = '';
      onstart: any; onresult: any; onerror: any; onend: any;
      running = false;
      // Like a real browser: speech can only be heard after onstart has fired.
      started = false;
      start() {
        if (this.running) throw new Error('already started');
        this.running = true;
        w.__recognition = this;
        setTimeout(() => {
          if (!this.running) return;
          this.started = true;
          if (this.onstart) this.onstart();
        }, 0);
      }
      stop() {
        if (!this.running) return;
        this.running = false;
        this.started = false;
        setTimeout(() => { if (this.onend) this.onend(); }, 0);
      }
    }
    w.SpeechRecognition = FakeRecognition;
    w.webkitSpeechRecognition = FakeRecognition;
    // The test "speaks" one final sentence into the recognizer once it is listening.
    w.__say = (text: string) => {
      const r = w.__recognition;
      if (!r || !r.started) return false;
      const result: any = [{ transcript: text }];
      result.isFinal = true;
      r.onresult({ resultIndex: 0, results: [result] });
      return true;
    };
    class FakeUtterance { text: string; onstart: any; onend: any; onerror: any; constructor(t: string) { this.text = t; } }
    w.SpeechSynthesisUtterance = FakeUtterance;
    Object.defineProperty(w, 'speechSynthesis', {
      configurable: true,
      value: {
        speak(u: any) {
          setTimeout(() => {
            if (u.onstart) u.onstart();
            setTimeout(() => { if (u.onend) u.onend(); }, 20);
          }, 0);
        },
        cancel() {},
      },
    });
  });
});

test('the companion sends the whole conversation with every turn (it remembers)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  const agentId = '44444444-5555-4666-8777-888888888888';
  const chats: Array<{ message: string; history: Array<{ role: string; text: string }> }> = [];
  await stubBackend(page, {
    [`/api/v2/agents/${agentId}/chat`]: (route, req) => {
      chats.push(req.body);
      return ok(route, { text: chats.length === 1 ? 'Nice to meet you, Riya!' : 'Your name is Riya.' });
    },
    '/api/v2/agents': (route) => route.request().method() === 'POST'
      ? ok(route, { id: agentId, name: 'Companion - Sam', agentType: 'conversational', status: 'active', systemPrompt: 'x', agentConfig: '{}', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      : ok(route, []),
  });

  await page.goto('/dashboard/companion');
  await page.getByPlaceholder('e.g., Samantha').fill('Sam', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Create Companion' }).click();
  await page.getByRole('button', { name: 'Talk Now' }).click();
  await page.getByRole('button', { name: 'Start talking' }).click();

  await expect.poll(() => page.evaluate(() => (window as any).__say('My name is Riya.'))).toBe(true);
  await expect.poll(() => chats.length).toBe(1);
  // The reply is spoken, then the companion listens again by itself.
  await expect.poll(() => page.evaluate(() => (window as any).__say('What is my name?'))).toBe(true);
  await expect.poll(() => chats.length).toBe(2);

  expect(chats[0]).toEqual({ message: 'My name is Riya.', history: [] });
  expect(chats[1].message).toBe('What is my name?');
  expect(chats[1].history).toEqual([
    { role: 'user', text: 'My name is Riya.' },
    { role: 'model', text: 'Nice to meet you, Riya!' },
  ]);
  await expect(page.getByRole('button', { name: 'End call' })).toBeVisible();
  await page.screenshot({ path: '../docs/proof/companion/companion-call-1440.png' });
});

test('phone width (390 px): the call screen and its labelled buttons fit', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsTestUser(page);
  const agentId = '44444444-5555-4666-8777-888888888888';
  await stubBackend(page, {
    '/api/v2/agents': (route) => route.request().method() === 'POST'
      ? ok(route, { id: agentId, name: 'Companion - Sam', agentType: 'conversational', status: 'active', systemPrompt: 'x', agentConfig: '{}', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      : ok(route, []),
  });
  await page.goto('/dashboard/companion');
  await page.getByPlaceholder('e.g., Samantha').fill('Sam', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Create Companion' }).click();
  await page.getByRole('button', { name: 'Talk Now' }).click();
  await expect(page.getByRole('button', { name: 'Start talking' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: '../docs/proof/companion/companion-call-390.png' });
});
