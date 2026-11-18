import { test, expect } from '@playwright/test';
import { loginAsTestUser, stubBackend, ok } from './helpers/dashboard';

/**
 * Issue B14 — the call recording plays through a short-lived signed link fetched on demand
 * (never the carrier's own link), with speed control and download.
 */
const CALL = {
  id: 'call-rec-1', callId: 'call-rec-1', status: 'completed', callDirection: 'outbound', direction: 'outbound',
  recipientPhoneNumber: '+919812345678', contactNumber: '+919812345678', fromPhoneNumber: '+918045671234',
  agentName: 'Clinic Booker', durationSeconds: 90, billedMinutes: 2, hasRecording: true, recordingUrl: null,
  hasTranscript: true, summary: 'Booked a cleaning.', createdAt: new Date().toISOString(),
};

test('Play fetches a signed link and plays our stream; speed and download offered', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  const seen = await stubBackend(page, {
    '/api/v2/calls/call-rec-1/recording-link': (route) => ok(route, {
      url: '/api/v2/recordings/call-rec-1/stream?u=user&e=1&s=sig',
      downloadUrl: '/api/v2/recordings/call-rec-1/stream?u=user&e=1&s=sig&download=1',
      expiresAt: new Date(Date.now() + 300000).toISOString(),
    }),
    '/api/v2/recordings/': (route) => route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.alloc(0) }),
    '/api/v2/calls/call-rec-1/transcript': (route) => ok(route, []),
    '/api/v2/calls': (route) => ok(route, [CALL]),
  });
  await page.goto('/dashboard/calls');
  await page.getByRole('button', { name: /Transcript/ }).first().click({ timeout: 30_000 });
  const player = page.getByTestId('recording-player');
  await expect(player).toBeVisible();
  await player.getByRole('button', { name: /Play recording/ }).click();
  const audio = player.locator('audio');
  await expect(audio).toHaveAttribute('src', /\/api\/v2\/recordings\/call-rec-1\/stream\?/);
  await expect(player.getByLabel('Playback speed')).toBeVisible();
  await expect(player.getByRole('link', { name: /Download/ })).toHaveAttribute('href', /download=1/);
  expect(seen.some((r) => r.url.includes('/recording-link'))).toBe(true);
  expect(seen.some((r) => /plivo|vobiz/i.test(r.url))).toBe(false);
});
