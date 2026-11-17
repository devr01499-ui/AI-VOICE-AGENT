import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * Issue F2 — sign-up, sign-in, Google and forgot/reset password.
 *
 * Every request that leaves the local dev server is stubbed, so these tests never
 * reach the real backend, Supabase or Google. They check what the form sends and
 * what the visitor is shown.
 */

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

interface Captured { url: string; method: string; body: any }

async function stubNetwork(page: Page, handlers: Record<string, (route: Route, body: any) => unknown> = {}): Promise<Captured[]> {
  const seen: Captured[] = [];
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, async (route) => {
    const req = route.request();
    const url = req.url();
    let body: any = null;
    try { body = req.postDataJSON(); } catch { body = req.postData(); }
    seen.push({ url, method: req.method(), body });
    for (const [fragment, handler] of Object.entries(handlers)) {
      if (url.includes(fragment)) return handler(route, body);
    }
    if (url.split('?')[0].endsWith('.js')) return route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
    return json(route, 200, { success: true, data: {} });
  });
  return seen;
}

async function openAuth(page: Page, path: string) {
  await page.goto(path);
  // The dev server compiles pages on first request; allow for that when many tests start together.
  await expect(page.getByRole('heading', { name: /Welcome Back|Create Workspace|Reset Password|Set New Password/ })).toBeVisible({ timeout: 30_000 });
}

async function fillSignup(page: Page, v: { name?: string; phone?: string; email?: string; password?: string }) {
  await page.getByPlaceholder('e.g. John Doe').fill(v.name ?? 'Asha Verma');
  await page.getByPlaceholder('+91 98765 43210').fill(v.phone ?? '98765 43210');
  await page.getByPlaceholder('you@company.com').fill(v.email ?? 'Asha.Verma@Example.org');
  await page.getByPlaceholder('••••••••••').fill(v.password ?? 'Str0ngPass99');
  await page.getByRole('button', { name: /Create Account/ }).click();
}

/** Ticks the two consent boxes inside the sign-up pop-up (not the Google Calendar box behind it). */
async function acceptTerms(page: Page) {
  await page.locator('label', { hasText: 'Terms and Conditions' }).getByRole('checkbox').check();
  await page.locator('label', { hasText: 'explicit consent' }).getByRole('checkbox').check();
}

test.describe('Sign-up', () => {
  test('rejects an invalid mobile number before anything is sent', async ({ page }) => {
    const seen = await stubNetwork(page);
    await openAuth(page, '/signup');
    await fillSignup(page, { phone: '12345' });
    await expect(page.getByText(/valid mobile number/i)).toBeVisible();
    await expect(page.getByText('I Agree & Create Account')).not.toBeVisible();
    expect(seen.filter((r) => r.url.includes('validate-signup') || r.url.includes('/auth/v1/signup'))).toHaveLength(0);
  });

  test('rejects a weak password before anything is sent', async ({ page }) => {
    const seen = await stubNetwork(page);
    await openAuth(page, '/signup');
    await fillSignup(page, { password: 'abcdefgh' });
    await expect(page.getByText(/at least one letter and one number/i)).toBeVisible();
    expect(seen.filter((r) => r.url.includes('/auth/v1/signup'))).toHaveLength(0);
  });

  test('valid details: server pre-check, consent, then account creation with normalised email and phone', async ({ page }) => {
    const seen = await stubNetwork(page, {
      '/api/v2/user/validate-signup': (route, body) =>
        json(route, 200, { success: true, data: { normalizedEmail: String(body.email).trim().toLowerCase(), normalizedContactNumber: '+919876543210', valid: true } }),
      '/api/v2/user/consent': (route) => json(route, 200, { success: true, data: { recorded: true } }),
      '/auth/v1/signup': (route, body) =>
        json(route, 200, { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', email: body.email, user_metadata: body.data, app_metadata: {}, identities: [], created_at: new Date().toISOString() }),
    });
    await openAuth(page, '/signup');
    await fillSignup(page, {});

    await acceptTerms(page);
    await page.getByRole('button', { name: /I Agree & Create Account/ }).click();

    await expect(page.getByText(/verification link has been sent/i)).toBeVisible();

    const validate = seen.find((r) => r.url.includes('validate-signup'))!;
    expect(validate.body.contactNumber).toBe('98765 43210');
    const signup = seen.find((r) => r.url.includes('/auth/v1/signup'))!;
    expect(signup.body.email).toBe('asha.verma@example.org');
    expect(signup.body.data.contact_number).toBe('+919876543210');
    // Order matters: the account is only created after the server pre-check passed.
    expect(seen.indexOf(validate)).toBeLessThan(seen.indexOf(signup));
  });

  test('an existing email gets a clear message and no account is created', async ({ page }) => {
    const seen = await stubNetwork(page, {
      '/api/v2/user/validate-signup': (route) =>
        json(route, 409, { success: false, error: 'DUPLICATE_EMAIL', message: 'An account with this email address already exists. Please sign in instead.' }),
    });
    await openAuth(page, '/signup');
    await fillSignup(page, {});
    await acceptTerms(page);
    await page.getByRole('button', { name: /I Agree & Create Account/ }).click();

    await expect(page.getByText(/already exists\. Please sign in instead/i)).toBeVisible();
    expect(seen.filter((r) => r.url.includes('/auth/v1/signup'))).toHaveLength(0);
  });
});

test.describe('Sign-in', () => {
  test('wrong password shows a plain message; email is sent trimmed and lower-case', async ({ page }) => {
    const seen = await stubNetwork(page, {
      '/auth/v1/token': (route) =>
        json(route, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }),
    });
    await openAuth(page, '/login');
    await page.getByPlaceholder('you@company.com').fill('  Asha.Verma@Example.org ');
    await page.getByPlaceholder('••••••••••').fill('wrong-password1');
    await page.getByRole('button', { name: /Sign In to Dashboard/ }).click();

    await expect(page.getByText('Incorrect email or password.')).toBeVisible();
    const token = seen.find((r) => r.url.includes('/auth/v1/token'))!;
    expect(token.body.email).toBe('asha.verma@example.org');
  });

  test('Continue with Google starts OAuth and returns to /dashboard', async ({ page }) => {
    await stubNetwork(page);
    await openAuth(page, '/login');
    const authorize = page.waitForRequest((r) => r.url().includes('/auth/v1/authorize'));
    await page.getByRole('button', { name: /Continue with Google/ }).click();
    const url = new URL((await authorize).url());
    expect(url.searchParams.get('provider')).toBe('google');
    expect(url.searchParams.get('redirect_to')).toMatch(/\/dashboard$/);
  });
});

test.describe('Forgot and reset password', () => {
  for (const [label, status] of [['known email', 200], ['unknown email', 400]] as const) {
    test(`forgot password gives the same neutral answer for a ${label}`, async ({ page }) => {
      const seen = await stubNetwork(page, {
        '/auth/v1/recover': (route) => (status === 200 ? json(route, 200, {}) : json(route, 400, { code: 400, msg: 'User not found' })),
      });
      await openAuth(page, '/login');
      await page.getByRole('button', { name: 'Forgot password?' }).click();
      await page.getByPlaceholder('you@company.com').fill('Someone@Example.org');
      await page.getByRole('button', { name: /Send Reset Link/ }).click();

      await expect(page.getByText(/If an account exists for that email/i)).toBeVisible();
      await expect(page.getByText(/User not found/i)).not.toBeVisible();
      const recover = seen.find((r) => r.url.includes('/auth/v1/recover'))!;
      expect(recover.body.email).toBe('someone@example.org');
      expect(recover.url).toMatch(/redirect_to=[^&]*dashboard/);
    });
  }

  test('a reset-password link opens the "set new password" form and enforces the password policy', async ({ page }) => {
    const seen = await stubNetwork(page);
    await page.goto('/dashboard#type=recovery');
    await expect(page.getByRole('heading', { name: 'Set New Password' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Total Calls')).not.toBeVisible();

    await page.getByPlaceholder('••••••••••').fill('short1');
    await page.getByRole('button', { name: /Update Password/ }).click();
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
    expect(seen.filter((r) => r.method === 'PUT' && r.url.includes('/auth/v1/user'))).toHaveLength(0);
  });

  test('an expired or used link explains itself and offers a new one', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/dashboard#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    await expect(page.getByText(/link has expired or was already used/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /Send Reset Link/ })).toBeVisible();
  });
});

test.describe('Sign-up form layout', () => {
  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]] as const) {
    test(`validation message is visible and nothing overflows at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height });
      await stubNetwork(page);
      await openAuth(page, '/signup');
      await fillSignup(page, { phone: '12345' });
      const message = page.getByText(/valid mobile number/i);
      await message.scrollIntoViewIfNeeded();
      await expect(message).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      await page.screenshot({ path: testInfo.outputPath(`signup-${name}.png`) });
    });
  }
});
