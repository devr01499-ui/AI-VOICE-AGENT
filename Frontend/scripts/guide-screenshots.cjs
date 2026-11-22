/**
 * Screenshots for the public dashboard guide (/guide), taken from the REAL dashboard running
 * against the local demo backend (server/scripts/demo_backend.js, TEST database, fictional data).
 * Every non-local request is blocked (lib/demoBrowser.cjs). Images are encoded as WebP by
 * Chromium itself (no image library needed) and written to public/guide/.
 *
 * Usage (demo backend on 54400 and Vite on 5180 pointed at it, see docs/PROGRESS.md "Decisions"):
 *   node scripts/guide-screenshots.cjs [frontendUrl]
 * Re-run it whenever a dashboard screen changes, so the guide never shows an old layout.
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { newDemoContext } = require('./lib/demoBrowser.cjs');

const base = process.argv[2] || 'http://localhost:5180';
const outDir = path.resolve(__dirname, '../public/guide');

const clickButton = (name) => async (page) => { await page.getByRole('button', { name }).first().click(); };
const clickText = (text) => async (page) => { await page.getByText(text, { exact: true }).first().click(); };

/** name → dashboard section + optional action that opens a dialog, tab or drawer. */
const SHOTS = [
  { name: 'agents', section: '' },
  { name: 'create-agent', section: '', action: clickButton(/Create an Agent/i) },
  { name: 'agent-editor', section: '', action: async (page) => { await page.getByRole('row', { name: /Lotus Dental/ }).getByRole('button', { name: /Edit Studio/i }).click(); } },
  // Live transfers and WhatsApp: the receptionist's hand-off functions, and the WhatsApp step.
  { name: 'handoff-functions', section: '', action: async (page) => {
    await page.getByRole('row', { name: /Lotus Dental Receptionist/ }).getByRole('button', { name: /Edit Studio/i }).click();
    await page.getByRole('button', { name: /Functions \(3\)/ }).click();
    await page.getByText('send_appointment_confirmation').scrollIntoViewIfNeeded();
  } },
  { name: 'whatsapp-step', section: '', action: async (page) => {
    await page.getByRole('row', { name: /Lotus Dental Receptionist/ }).getByRole('button', { name: /Edit Studio/i }).click();
    await page.getByRole('button', { name: /Functions \(3\)/ }).click();
    await page.getByTitle('Edit Function').nth(2).click();
    await page.getByText(/your appointment at Lotus Dental Clinic is confirmed/).first().waitFor();
  } },
  { name: 'call-handoffs', section: 'calls', action: async (page) => {
    await page.getByRole('button', { name: /Transcript/i }).first().click();
    await page.getByTestId('call-handoffs').scrollIntoViewIfNeeded();
  } },
  { name: 'knowledge-base', section: 'knowledge' },
  { name: 'phone-numbers', section: 'numbers' },
  { name: 'calling-config', section: 'calling' },
  { name: 'batch-calls', section: 'batch' },
  { name: 'batch-new-campaign', section: 'batch', action: clickButton(/New campaign/i) },
  { name: 'call-history', section: 'calls' },
  { name: 'call-transcript', section: 'calls', action: clickButton(/Transcript/i) },
  { name: 'contacts', section: 'contacts' },
  { name: 'analytics', section: 'analytics' },
  { name: 'live-monitoring', section: 'live_monitoring' },
  { name: 'quality-assurance', section: 'qa' },
  { name: 'call-reports', section: 'reports' },
  { name: 'alerting', section: 'alerting' },
  { name: 'integrations', section: 'integrations' },
  { name: 'billing', section: 'billing' },
  { name: 'settings', section: 'settings' },
  { name: 'settings-kyc', section: 'settings', action: clickText('KYC & Compliance') },
  { name: 'settings-api-keys', section: 'settings', action: clickText('API & Keys') },
  { name: 'settings-team', section: 'settings', action: async (page) => { await page.getByText(/^Team/).first().click(); } },
];

/** PNG buffer → WebP bytes, encoded by the browser's own canvas. */
async function toWebp(page, png, quality = 0.82) {
  const dataUrl = await page.evaluate(async ({ b64, q }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return canvas.toDataURL('image/webp', q);
  }, { b64: png.toString('base64'), q: quality });
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const { context } = await newDemoContext(browser);
  const problems = [];
  // GUIDE_SHOTS=name,name retakes only those screens (the others keep their current image).
  const only = (process.env.GUIDE_SHOTS || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const shot of SHOTS.filter((s) => !only.length || only.includes(s.name))) {
    const page = await context.newPage();
    page.on('pageerror', (e) => problems.push(`${shot.name}: CRASH ${String(e.message).slice(0, 160)}`));
    page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) problems.push(`${shot.name}: console ${m.text().slice(0, 160)}`); });
    await page.goto(`${base}/dashboard${shot.section ? `/${shot.section}` : ''}`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(1200);
    if (shot.action) {
      try { await shot.action(page); } catch (e) { problems.push(`${shot.name}: action failed ${String(e.message).slice(0, 120)}`); }
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(900);
    }
    const png = await page.screenshot({ type: 'png' });
    const webp = await toWebp(page, png);
    fs.writeFileSync(path.join(outDir, `${shot.name}.webp`), webp);
    console.log(`  ${shot.name}.webp  ${(webp.length / 1024).toFixed(0)} KB`);
    await page.close();
  }
  await browser.close();
  if (problems.length) { console.log('\nPROBLEMS:\n  ' + problems.join('\n  ')); process.exit(1); }
  console.log(`\nGUIDE SCREENSHOTS: ${SHOTS.length} written to public/guide/`);
})();
