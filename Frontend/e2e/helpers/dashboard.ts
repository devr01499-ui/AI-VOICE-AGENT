import type { Page, Route } from '@playwright/test';

/**
 * Test helpers for dashboard pages.
 *
 * `loginAsTestUser` plants a fake, unexpired Supabase session in the browser so the
 * app takes its logged-in path, and `stubBackend` answers every request that leaves
 * the local dev server. Nothing here can reach the real backend, Supabase or a carrier.
 */

export const TEST_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'e2e.user@example.org',
  fullName: 'E2E Test User',
};

export interface CapturedRequest { url: string; method: string; body: any }
export type StubHandler = (route: Route, request: CapturedRequest) => unknown;

export const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** Standard API envelope used by the backend: { success, data }. */
export const ok = (route: Route, data: unknown) => json(route, 200, { success: true, data });

export async function loginAsTestUser(page: Page): Promise<void> {
  await page.addInitScript((user) => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const accessToken = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, exp, role: 'authenticated', email: user.email, aud: 'authenticated' })}.e2e-signature`;
    const session = {
      access_token: accessToken,
      refresh_token: 'e2e-refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: exp,
      user: {
        id: user.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: user.email,
        email_confirmed_at: new Date().toISOString(),
        user_metadata: { full_name: user.fullName, has_consented_terms: true },
        app_metadata: { provider: 'email' },
        created_at: new Date().toISOString(),
      },
    };
    window.localStorage.setItem('claritiy_voice_supabase_auth_token', JSON.stringify(session));
    window.localStorage.setItem('token', accessToken);
  }, TEST_USER);
}

/**
 * Answers every non-local request. `handlers` maps a URL fragment to a handler; the
 * first matching fragment wins, so list specific fragments before general ones.
 * Unmatched API calls get an empty list, which every dashboard page must tolerate.
 */
export async function stubBackend(page: Page, handlers: Record<string, StubHandler> = {}): Promise<CapturedRequest[]> {
  const seen: CapturedRequest[] = [];
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, async (route) => {
    const req = route.request();
    const url = req.url();
    let body: any = null;
    try { body = req.postDataJSON(); } catch { body = req.postData(); }
    const captured = { url, method: req.method(), body };
    seen.push(captured);
    for (const [fragment, handler] of Object.entries(handlers)) {
      if (url.includes(fragment)) return handler(route, captured);
    }
    if (url.includes('/auth/v1/user')) return json(route, 200, { id: TEST_USER.id, email: TEST_USER.email, aud: 'authenticated', user_metadata: { full_name: TEST_USER.fullName } });
    if (url.split('?')[0].endsWith('.js')) return route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
    if (url.includes('/api/')) return ok(route, []);
    return json(route, 200, {});
  });
  return seen;
}
