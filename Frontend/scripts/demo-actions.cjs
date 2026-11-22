/**
 * Clicks through the main actions of the dashboard against the REAL local API (demo backend, TEST
 * database) and reports anything that breaks: crashes, console errors, API answers >= 400 and
 * actions whose result does not appear. Every non-local request is blocked (lib/demoBrowser.cjs).
 * Usage: WALK_API=http://127.0.0.1:54400 node scripts/demo-actions.cjs [frontendUrl]
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { newDemoContext } = require('./lib/demoBrowser.cjs');
const base = process.argv[2] || 'http://localhost:5180';
const api = process.env.WALK_API || 'http://127.0.0.1:54400';

const STEPS = [
  {
    name: 'agent editor: edit, Save, reload, text persisted',
    url: '/dashboard',
    run: async (page) => {
      await page.getByRole('row', { name: /COD Order/ }).getByRole('button', { name: /Edit Studio/i }).click();
      const box = page.locator('textarea').first();
      await box.waitFor();
      const marker = ` Audit marker ${Date.now()}.`;
      await box.click();
      await box.press('End');
      await box.type(marker);
      await page.getByRole('button', { name: /^Save$/ }).click();
      await page.waitForResponse((r) => r.url().startsWith(api + '/api/v2/agents/') && r.request().method() === 'PUT', { timeout: 15000 });
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByRole('row', { name: /COD Order/ }).getByRole('button', { name: /Edit Studio/i }).click();
      await page.locator('textarea').first().waitFor();
      const text = await page.locator('textarea').first().inputValue();
      if (!text.includes(marker.trim())) throw new Error('saved instructions did not persist after reload');
    },
  },
  {
    name: 'contacts: Add Contact appears in the list',
    url: '/dashboard/contacts',
    run: async (page) => {
      await page.getByRole('button', { name: /Add Contact/i }).first().click();
      await page.getByPlaceholder('+91 98765 43210').fill('+919000012345');
      await page.getByPlaceholder(/Jane Doe/).fill('Audit Person');
      await page.getByRole('button', { name: /Save Contact/i }).click();
      await page.getByText('Audit Person').first().waitFor({ timeout: 10000 });
    },
  },
  {
    name: 'alerting: Create Alert Rule appears',
    url: '/dashboard/alerting',
    run: async (page) => {
      await page.getByRole('button', { name: /Create Alert Rule/i }).click();
      await page.getByPlaceholder(/High Error Rate/).fill('Audit rule');
      await page.getByRole('button', { name: /Save Rule/i }).click();
      await page.getByText('Audit rule').first().waitFor({ timeout: 10000 });
    },
  },
  {
    name: 'settings: Save display timezone',
    url: '/dashboard/settings',
    run: async (page) => {
      await page.getByRole('button', { name: /Save display timezone/i }).click();
      await page.waitForTimeout(800);
    },
  },
  {
    name: 'settings: change data retention',
    url: '/dashboard/settings',
    run: async (page) => {
      const sel = page.locator('select').nth(1);
      const opts = await sel.locator('option').allInnerTexts();
      const pick = opts.find((o) => /90|30/.test(o));
      if (!pick) throw new Error('no retention option found: ' + opts.join(' | '));
      const wait = page.waitForResponse((r) => r.url().includes('/api/v2/user/retention') && r.request().method() === 'POST', { timeout: 10000 });
      await sel.selectOption({ label: pick });
      // A shorter retention deletes data, so the page asks for confirmation first.
      await page.getByRole('button', { name: /Confirm \d+-Day Retention/i }).click();
      const res = await wait;
      if (res.status() >= 400) throw new Error('retention save answered ' + res.status());
    },
  },
  {
    name: 'API keys: Generate New Key shows the key once',
    url: '/dashboard/settings',
    run: async (page) => {
      await page.getByText('API & Keys', { exact: true }).first().click();
      const name = page.getByPlaceholder(/key name|name/i).first();
      if (await name.count()) await name.fill('Audit key');
      await page.getByRole('button', { name: /Generate New Key/i }).click();
      await page.getByText(/You will not be able to see/i).first().waitFor({ timeout: 10000 });
    },
  },
  {
    name: 'QA: New QA Cohort appears',
    url: '/dashboard/qa',
    run: async (page) => {
      await page.getByRole('button', { name: /New QA Cohort/i }).click();
      await page.getByPlaceholder(/Weekly Inbound/).fill('Audit cohort');
      await page.getByRole('button', { name: /^Create Cohort$/i }).click();
      await page.getByText('Audit cohort').first().waitFor({ timeout: 10000 });
    },
  },
  {
    name: 'knowledge base: upload a .txt document',
    url: '/dashboard/knowledge',
    run: async (page) => {
      const file = path.join(require('os').tmpdir(), 'audit-faq.txt');
      fs.writeFileSync(file, 'Audit FAQ. The clinic is closed on Sundays. Parking is free for patients.');
      await page.getByRole('button', { name: /Add document/i }).click();
      const input = page.locator('input[type="file"]').first();
      await input.setInputFiles(file);
      const upload = page.getByRole('button', { name: /^(Upload|Add|Save)( document)?$/i });
      if (await upload.count()) await upload.last().click();
      await page.getByText('audit-faq.txt').first().waitFor({ timeout: 15000 });
    },
  },
  {
    name: 'notifications bell opens',
    url: '/dashboard',
    run: async (page) => {
      await page.locator('header button, button').filter({ has: page.locator('svg.lucide-bell') }).first().click();
      await page.waitForTimeout(800);
    },
  },
];

(async () => {
  const browser = await chromium.launch();
  const { context } = await newDemoContext(browser);
  let failed = 0;
  for (const step of STEPS) {
    const page = await context.newPage();
    const problems = [];
    page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) problems.push(`console: ${m.text().slice(0, 200)}`); });
    page.on('pageerror', (e) => problems.push(`CRASH: ${String(e.message).slice(0, 200)}`));
    page.on('response', (r) => { const u = r.url(); if (u.startsWith(api) && r.status() >= 400) problems.push(`API ${r.status()} ${r.request().method()} ${u.replace(api, '')}`); });
    try {
      await page.goto(base + step.url, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(800);
      await step.run(page);
    } catch (e) { problems.push(`step failed: ${String(e.message).split('\n')[0].slice(0, 220)}`); }
    console.log(`${problems.length ? '✗' : '✓'} ${step.name}`);
    for (const p of [...new Set(problems)]) console.log('    ' + p);
    if (problems.length) { failed++; await page.screenshot({ path: path.join(require('os').tmpdir(), `audit-${step.name.replace(/\W+/g, '_').slice(0, 40)}.png`) }).catch(() => {}); }
    await page.close();
  }
  await browser.close();
  console.log(`\nDEMO ACTIONS: ${failed ? failed + ' failing' : 'ALL PASS'} (${STEPS.length} actions)`);
  process.exit(failed ? 1 : 0);
})();
