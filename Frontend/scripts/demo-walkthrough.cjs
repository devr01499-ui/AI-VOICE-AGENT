/**
 * Demo walkthrough against the REAL local API (server/scripts/demo_backend.js): opens every dashboard
 * page as the seeded demo user and reports console errors, page crashes, failed API calls and
 * visible error banners. Nothing may reach production: every non-local request is blocked (the
 * Supabase auth endpoints get a local stand-in).
 * Usage: node scripts/demo-walkthrough.cjs [frontendUrl] [screenshotDir]
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const base = process.argv[2] || 'http://localhost:5180';
const shotDir = process.argv[3] || '';
const USER = { id: '00000000-0000-4000-8000-000000000001', email: 'e2e.user@example.org', fullName: 'Asha Verma (Demo)' };
// "agent_studio" / "create_agent" open the first agent's editor / the Create Agent dialog from the Agents page.
const SECTIONS = ['agent_studio', 'create_agent', 'agents','calling', 'batch', 'calls', 'numbers', 'knowledge', 'voices', 'calendar', 'settings', 'billing', 'companion', 'chat_history', 'contacts', 'analytics', 'live_monitoring', 'qa', 'alerting', 'integrations', 'reports'];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Kolkata' });
  await context.addInitScript((user) => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const b64 = (o) => btoa(JSON.stringify(o)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, exp, role: 'authenticated', email: user.email, aud: 'authenticated' })}.demo`;
    const session = { access_token: token, refresh_token: 'demo', token_type: 'bearer', expires_in: 3600, expires_at: exp,
      user: { id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, email_confirmed_at: new Date().toISOString(), user_metadata: { full_name: user.fullName, has_consented_terms: true }, app_metadata: { provider: 'email' }, created_at: new Date().toISOString() } };
    localStorage.setItem('claritiy_voice_supabase_auth_token', JSON.stringify(session));
    localStorage.setItem('token', token);
  }, USER);
  // Block everything that is not local; answer Supabase auth calls locally.
  await context.route((url) => !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(url.toString()), (route) => {
    const url = route.request().url();
    if (/\/auth\/v1\/user/.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: USER.id, email: USER.email, aud: 'authenticated', user_metadata: { full_name: USER.fullName } }) });
    if (/fonts\.(googleapis|gstatic)\.com/.test(url)) return route.fulfill({ status: 200, body: '' });
    return route.abort();
  });

  const report = [];
  const blocked = new Set();
  for (const section of SECTIONS) {
    const page = await context.newPage();
    const problems = [];
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource: net::ERR_FAILED/.test(m.text())) problems.push(`console: ${m.text().slice(0, 220)}`); });
    page.on('requestfailed', (r) => { const u = r.url(); if (/^https?:\/\/(localhost|127\.0\.0\.1)/.test(u)) problems.push('REQUEST FAILED ' + u); else blocked.add(new URL(u).host); });
    page.on('pageerror', (e) => problems.push(`CRASH: ${String(e.message).slice(0, 220)}`));
    page.on('response', (r) => {
      const u = r.url();
      if (/127\.0\.0\.1:54400/.test(u) && r.status() >= 400) problems.push(`API ${r.status()} ${r.request().method()} ${u.replace('http://127.0.0.1:54400', '')}`);
    });
    const onAgents = ['agents', 'agent_studio', 'create_agent'].includes(section);
    const url = onAgents ? `${base}/dashboard` : `${base}/dashboard/${section}`;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
      if (section === 'agent_studio') { await page.getByRole('button', { name: /Edit Studio/i }).first().click(); await page.waitForLoadState('networkidle'); }
      if (section === 'create_agent') { await page.getByRole('button', { name: /Create an Agent/i }).first().click(); await page.waitForLoadState('networkidle'); }
    } catch (e) { problems.push(`navigation: ${String(e.message).slice(0, 120)}`); }
    await page.waitForTimeout(1500);
    const banners = await page.locator('[role="alert"], .text-rose-700, .text-red-600, .text-red-500').allInnerTexts().catch(() => []);
    // A one-word status badge ("Failed" on a failed call) is data, not an error banner.
    for (const b of banners) if (b.trim() && !/^(failed|error)$/i.test(b.trim()) && /fail|error|could not|unable|wrong|denied/i.test(b)) problems.push(`banner: ${b.trim().slice(0, 160)}`);
    const bodyText = await page.locator('body').innerText().catch(() => '');
    if (/undefined|NaN|\[object Object\]|Invalid Date/.test(bodyText)) {
      const m = bodyText.match(/.{0,40}(undefined|NaN|\[object Object\]|Invalid Date).{0,40}/);
      problems.push(`text shows: "${m ? m[0].replace(/\s+/g, ' ') : ''}"`);
    }
    if (shotDir) { fs.mkdirSync(shotDir, { recursive: true }); await page.screenshot({ path: path.join(shotDir, `${section}.png`) }); }
    report.push({ section, problems: [...new Set(problems)] });
    await page.close();
  }
  await browser.close();
  let n = 0;
  for (const r of report) {
    console.log(`${r.problems.length ? '✗' : '✓'} ${r.section}`);
    for (const p of r.problems) { console.log(`    ${p}`); n++; }
  }
  console.log('blocked external hosts (expected, never contacted): ' + [...blocked].join(', '));
  console.log(`\nDEMO WALKTHROUGH: ${n === 0 ? 'CLEAN' : n + ' problems'} across ${report.length} pages`);
  process.exit(n === 0 ? 0 : 1);
})();
