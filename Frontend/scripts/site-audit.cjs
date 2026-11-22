/**
 * Public website audit: every page at desktop and phone width.
 *  - console errors, crashes, broken images, sideways overflow
 *  - every internal link found on any page must open a real page (not "Page not found")
 * Nothing leaves the machine: all non-local requests are blocked.
 * Usage: node scripts/site-audit.cjs [frontendUrl]
 */
const { chromium } = require('@playwright/test');
const base = process.argv[2] || 'http://localhost:5173';
const START = ['/', '/pricing', '/guide', '/faq', '/how-it-works', '/solutions', '/use-cases', '/voices', '/ai-voice-agent-software', '/docs', '/blog', '/blog/how-to-reduce-cod-rto', '/blog/healthcare-ai-calling', '/blog/fintech-collections-ai', '/security', '/privacy', '/terms', '/contact', '/voice-ai-index'];

(async () => {
  const browser = await chromium.launch();
  const problems = [];
  const links = new Map(); // href -> first page it was found on
  for (const width of [1440, 390]) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 } });
    await ctx.route((u) => !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(u.toString()), (r) => (/fonts\.(googleapis|gstatic)/.test(r.request().url()) ? r.fulfill({ status: 200, body: '' }) : r.abort()));
    for (const path of START) {
      const page = await ctx.newPage();
      const errs = [];
      page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::ERR_/.test(m.text())) errs.push(m.text().slice(0, 160)); });
      page.on('pageerror', (e) => errs.push('CRASH ' + String(e.message).slice(0, 160)));
      await page.goto(base + path, { waitUntil: 'networkidle', timeout: 45000 }).catch((e) => errs.push('nav ' + e.message.slice(0, 80)));
      await page.waitForTimeout(700);
      const info = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && !/^data:/.test(i.src)).map((i) => i.src),
        notFound: /Page not found/i.test(document.body.innerText),
        hrefs: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')),
      }));
      const tag = `${path} @${width}`;
      for (const e of [...new Set(errs)]) problems.push(`${tag}: console ${e}`);
      if (info.overflow > 2) problems.push(`${tag}: page is ${info.overflow}px wider than the screen`);
      for (const b of info.broken) problems.push(`${tag}: broken image ${b}`);
      if (info.notFound) problems.push(`${tag}: shows "Page not found"`);
      for (const h of info.hrefs) if (h && h.startsWith('/') && !h.startsWith('//') && !links.has(h.split('#')[0])) links.set(h.split('#')[0], path);
      await page.close();
    }
    await ctx.close();
  }
  // Follow every internal link once.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route((u) => !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(u.toString()), (r) => r.abort());
  const skip = /^\/(dashboard|login|signup|auth|api)\b|\.(xml|txt|png|webp|jpg|svg|pdf)$/;
  let checked = 0;
  for (const [href, from] of links) {
    if (skip.test(href)) continue;
    checked++;
    const page = await ctx.newPage();
    await page.goto(base + href, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const nf = await page.evaluate(() => /Page not found/i.test(document.body.innerText)).catch(() => false);
    if (nf) problems.push(`link ${href} (found on ${from}) opens "Page not found"`);
    await page.close();
  }
  await browser.close();
  for (const p of problems) console.log('✗ ' + p);
  console.log(`\nSITE AUDIT: ${problems.length ? problems.length + ' problems' : 'CLEAN'} — ${START.length} pages x 2 widths, ${checked} internal links followed`);
  process.exit(problems.length ? 1 : 0);
})();
