import { test, expect, type Page } from '@playwright/test';
import { stubBackend } from './helpers/dashboard';

/**
 * Audit batch 11 — public website and SEO (docs/AUDIT_FINDINGS.md):
 *  #120 the Voice AI Index hub is its own canonical page   #121 leaving it does not overwrite the next page's tags
 *  #123 no FAQ structured data for questions a page does not show   #124 no fake newsletter form
 *  #125 unknown URLs are a "Page not found" page (noindex), not the home page
 *  #128 "Join Now" opens sign-up   #129/#130/#136 footer links go to the page they name (real links)
 *  #131 the canonical follows the industry shown   #134 runtime titles = the shared seoPages.json
 *  #135 app pages are noindex
 */
import fs from 'fs';
import path from 'path';
const SEO = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'src/app/data/seoPages.json'), 'utf-8')).pages;

const canonical = (page: Page) => page.locator('link[rel="canonical"]').getAttribute('href');
const robots = (page: Page) => page.locator('meta[name="robots"]').getAttribute('content');
const description = (page: Page) => page.locator('meta[name="description"]').getAttribute('content');

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubBackend(page);
});

test('#125 unknown URLs, industries and topics show "Page not found" and are noindex', async ({ page }) => {
  for (const url of ['/no-such-page', '/use-cases/space-travel', '/voice-ai-index/not-a-topic']) {
    await page.goto(url);
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => robots(page)).toContain('noindex');
  }
});

test('#120 #121 the index hub is its own canonical; leaving it keeps the next page\'s tags', async ({ page }) => {
  await page.goto('/voice-ai-index');
  await expect.poll(() => canonical(page), { timeout: 30_000 }).toBe('https://www.claritiy.com/voice-ai-index');
  await expect(page).toHaveTitle(SEO['voice-ai-index'].title);
  await page.goto('/voice-ai-index/soc2-voice-ai');
  await expect.poll(() => canonical(page), { timeout: 30_000 }).toBe('https://www.claritiy.com/voice-ai-index/soc2-voice-ai');
  await expect(page).toHaveTitle(/SOC 2 and voice AI: questions to ask a vendor/);
  // Leave through the footer: the pricing page's own tags must stay.
  await page.locator('footer').getByRole('link', { name: /^Pricing/ }).click();
  await expect(page).toHaveURL(/\/pricing$/);
  await page.waitForTimeout(1500); // the index page's exit animation and cleanup have run
  await expect(page).toHaveTitle(SEO.pricing.title);
  expect(await description(page)).toBe(SEO.pricing.description);
});

test('#134 runtime titles and descriptions equal the shared seoPages.json', async ({ page }) => {
  for (const path of ['how-it-works', 'solutions', 'faq']) {
    await page.goto(`/${path}`);
    await expect(page).toHaveTitle(SEO[path].title, { timeout: 30_000 });
    await expect.poll(() => description(page)).toBe(SEO[path].description);
  }
});

test('#123 Home and Pricing carry no FAQ structured data for questions they do not show', async ({ page }) => {
  for (const path of ['/', '/pricing']) {
    await page.goto(path);
    await expect(page).toHaveTitle(SEO[path === '/' ? '' : 'pricing'].title, { timeout: 30_000 });
    const schemas = await page.locator('script[type="application/ld+json"][data-schema]').allTextContents();
    expect(schemas.some((t) => t.includes('"FAQPage"'))).toBe(false);
  }
});

test('#135 the dashboard and sign-in pages are noindex', async ({ page }) => {
  for (const path of ['/dashboard', '/login', '/signup']) {
    await page.goto(path);
    await expect.poll(() => robots(page), { timeout: 30_000 }).toContain('noindex');
  }
});

test('#128 "Join Now" opens the sign-up form', async ({ page }) => {
  await page.goto('/pricing');
  await page.getByRole('button', { name: 'Join Now' }).first().click({ timeout: 30_000 });
  await expect(page.getByText('Create Workspace')).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/signup$/);
});

test('#129 #130 #136 footer items are real links to the page they name', async ({ page }) => {
  await page.goto('/pricing');
  const footer = page.locator('footer');
  await expect(footer.getByRole('link', { name: 'E-Commerce COD & RTO' })).toHaveAttribute('href', '/use-cases/ecommerce', { timeout: 30_000 });
  await expect(footer.getByRole('link', { name: 'BFSI & EMI Collections' })).toHaveAttribute('href', '/use-cases/finance');
  await expect(footer.getByRole('link', { name: 'Dental Clinic Scheduler' })).toHaveAttribute('href', '/blog/healthcare-ai-calling');
  await expect(footer.getByRole('link', { name: 'AI Voice Agent Software' })).toHaveAttribute('href', '/ai-voice-agent-software');
  await expect(footer.getByRole('link', { name: 'Blog & Guides' })).toHaveAttribute('href', '/blog');
  await expect(footer.getByRole('link', { name: /LinkedIn/ })).toHaveAttribute('href', 'https://www.linkedin.com/company/claritiy/');
  await footer.getByRole('link', { name: 'BFSI & EMI Collections' }).click();
  await expect(page).toHaveURL(/\/use-cases\/finance$/);
  await expect.poll(() => canonical(page)).toBe('https://www.claritiy.com/use-cases/finance');
});

test('#131 the canonical follows the industry tab shown', async ({ page }) => {
  await page.goto('/use-cases/healthcare');
  await expect.poll(() => canonical(page), { timeout: 30_000 }).toBe('https://www.claritiy.com/use-cases/healthcare');
  await page.getByRole('button', { name: /finance/i }).first().click();
  await expect(page).toHaveURL(/\/use-cases\/finance$/);
  await expect.poll(() => canonical(page)).toBe('https://www.claritiy.com/use-cases/finance');
});

test('#124 #130 the blog has no fake newsletter; the RTO article opens its own page', async ({ page }) => {
  await page.goto('/blog');
  await expect(page.getByRole('heading', { name: /Have a question about your use case/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByPlaceholder('Enter your work email...')).toHaveCount(0);
  await page.getByText('How Indian D2C Brands Cut COD RTO Rates by 40% Using Automated AI Voice Calls').first().click();
  await expect(page).toHaveURL(/\/blog\/how-to-reduce-cod-rto$/);
});

test('proof screenshots: not-found page, blog contact block, footer (1440 / 390)', async ({ page }) => {
  test.setTimeout(120_000);
  for (const vp of [{ name: '1440', width: 1440, height: 900 }, { name: '390', width: 390, height: 844 }]) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/no-such-page');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: `../docs/proof/audit-batch11-not-found-${vp.name}.png` });
    await page.goto('/blog');
    const cta = page.getByRole('heading', { name: /Have a question about your use case/ });
    await cta.scrollIntoViewIfNeeded({ timeout: 30_000 });
    await page.screenshot({ path: `../docs/proof/audit-batch11-blog-contact-${vp.name}.png` });
    await page.locator('footer').scrollIntoViewIfNeeded();
    await page.locator('footer').screenshot({ path: `../docs/proof/audit-batch11-footer-${vp.name}.png` });
  }
});
