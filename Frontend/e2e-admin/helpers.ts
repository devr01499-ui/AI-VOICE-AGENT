import type { Page } from '@playwright/test';

/** Supabase project ref baked into Admin/src/lib/supabase.ts (public; it names the storage key). */
const STORAGE_KEY = 'sb-elbgdgahyoyfbtuwsktx-auth-token';

const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

/** An unsigned token: the console only decodes it (aal level); the stubbed API never verifies it. */
function fakeJwt(userId: string): string {
  const now = Math.floor(Date.now() / 1000);
  return [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({ sub: userId, aud: 'authenticated', role: 'authenticated', aal: 'aal2', amr: [{ method: 'totp', timestamp: now }], iat: now, exp: now + 3600 * 24 }),
    'test-signature',
  ].join('.');
}

export const STAFF = {
  id: 'staff-e2e-1',
  email: 'owner@example.test',
  name: 'E2E Owner',
  role: 'owner',
  status: 'active',
  permissions: ['customers:view', 'settings:manage'],
};

/**
 * Signed-in owner with two-factor done. Every admin API call is stubbed: /admin/me returns the
 * staff profile, anything else an empty success envelope. Supabase network calls are refused.
 */
export async function signInAsStaff(page: Page): Promise<void> {
  const userId = 'user-e2e-1';
  const session = {
    access_token: fakeJwt(userId),
    refresh_token: 'e2e-refresh',
    token_type: 'bearer',
    expires_in: 3600 * 24,
    expires_at: Math.floor(Date.now() / 1000) + 3600 * 24,
    user: { id: userId, email: STAFF.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, factors: [] },
  };
  await page.addInitScript(([key, value]) => {
    window.localStorage.setItem(key, value);
  }, [STORAGE_KEY, JSON.stringify(session)] as const);

  await page.route('**/*.supabase.co/**', route => route.fulfill({ status: 503, body: '{}' }));
  await page.route('http://localhost:3001/**', route => {
    const url = new URL(route.request().url());
    const body = url.pathname === '/api/v2/admin/me'
      ? { success: true, data: STAFF }
      : { success: true, data: [] };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}
