/**
 * Browser context for the local demo backend (server/scripts/demo_backend.js): a signed-in session
 * for the seeded demo user, and every non-local request blocked, so nothing can ever reach
 * production (Supabase's user endpoint gets a local stand-in; fonts get an empty answer).
 * Used by scripts/demo-walkthrough.cjs and scripts/guide-screenshots.cjs.
 */
const DEMO_USER = { id: '00000000-0000-4000-8000-000000000001', email: 'e2e.user@example.org', fullName: 'Asha Verma' };
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)/;

async function newDemoContext(browser, { viewport = { width: 1440, height: 900 }, deviceScaleFactor = 1 } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor, timezoneId: 'Asia/Kolkata', locale: 'en-IN' });
  await context.addInitScript((user) => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const b64 = (o) => btoa(JSON.stringify(o)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, exp, role: 'authenticated', email: user.email, aud: 'authenticated' })}.demo`;
    const session = { access_token: token, refresh_token: 'demo', token_type: 'bearer', expires_in: 3600, expires_at: exp,
      user: { id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, email_confirmed_at: new Date().toISOString(), user_metadata: { full_name: user.fullName, has_consented_terms: true }, app_metadata: { provider: 'email' }, created_at: new Date().toISOString() } };
    localStorage.setItem('claritiy_voice_supabase_auth_token', JSON.stringify(session));
    localStorage.setItem('token', token);
  }, DEMO_USER);
  const blocked = new Set();
  await context.route((url) => !LOCAL.test(url.toString()), (route) => {
    const url = route.request().url();
    if (/\/auth\/v1\/user/.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: DEMO_USER.id, email: DEMO_USER.email, aud: 'authenticated', user_metadata: { full_name: DEMO_USER.fullName } }) });
    if (/fonts\.(googleapis|gstatic)\.com/.test(url)) return route.fulfill({ status: 200, body: '' });
    try { blocked.add(new URL(url).host); } catch {}
    return route.abort();
  });
  return { context, blocked };
}

module.exports = { DEMO_USER, LOCAL, newDemoContext };
