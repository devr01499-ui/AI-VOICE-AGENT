import { test, expect, type Page } from '@playwright/test';
import { stubBackend } from './helpers/dashboard';
import fs from 'fs';
import path from 'path';

/**
 * SEO / content pass (2026-11-22):
 *  - /guide: the product guide renders every section with its real dashboard screenshots, its own
 *    title/description/canonical, an index entry, and links from the navbar and footer.
 *  - Home: no invented testimonials, no unmeasured figures; the hero states the real offer.
 * Proof screenshots: docs/proof/seo-*.png (1440 and 390).
 */
const GUIDE = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'src/app/data/guideContent.json'), 'utf-8'));
const SEO = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'src/app/data/seoPages.json'), 'utf-8')).pages;
const PROOF = path.resolve(process.cwd(), '../docs/proof');

const meta = (page: Page, sel: string, attr: string) => page.locator(sel).getAttribute(attr);

test.beforeEach(async ({ page }) => {
  await stubBackend(page);
});

test('the product guide shows every section with its screenshots, and its own SEO tags', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/guide');
  await expect(page.getByRole('heading', { level: 1, name: SEO.guide.h1 })).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => page.title()).toBe(SEO.guide.title);
  await expect.poll(() => meta(page, 'link[rel="canonical"]', 'href')).toBe('https://www.claritiy.com/guide');
  await expect.poll(() => meta(page, 'meta[name="robots"]', 'content')).toContain('index, follow');

  for (const [id, s] of Object.entries<any>(GUIDE.sections)) {
    await expect(page.locator(`section#${id} h2`)).toHaveText(s.title);
    for (const img of s.images) {
      const el = page.locator(`img[src="${img.src}"]`);
      await el.scrollIntoViewIfNeeded();
      await expect.poll(() => el.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
      await expect(el).toHaveAttribute('alt', img.alt);
    }
  }
  // Plan facts are filled in from lib/plans.ts, never left as placeholders.
  await expect(page.locator('body')).not.toContainText('{plans}');
  await expect(page.locator('body')).not.toContainText('{lowestPlan}');
  // No sideways scrolling at desktop width.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test('the guide is reachable from the navbar Resources menu and the footer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: /Resources/ }).hover();
  await page.getByRole('button', { name: /Product Guide/ }).click();
  await expect(page).toHaveURL(/\/guide$/);
  await page.goto('/');
  const footerLink = page.locator('footer a[href="/guide"]');
  await expect(footerLink).toHaveCount(1, { timeout: 30_000 });
});

test('home page: example setups instead of testimonials, and no unmeasured figures', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: SEO[''].h1 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('These are typical setups built with the product, not customer quotes.')).toBeVisible();
  const text = await page.locator('body').innerText();
  for (const banned of ['99.9%', 'MSME', 'Warm Transfer', '94.2%', '89%', 'Commodities are hot']) expect(text).not.toContain(banned);
});

test('proof screenshots: guide and home at 1440 and 390', async ({ page }) => {
  test.setTimeout(120_000);
  for (const vp of [{ name: '1440', width: 1440, height: 900 }, { name: '390', width: 390, height: 844 }]) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/guide');
    await expect(page.getByRole('heading', { level: 1, name: SEO.guide.h1 })).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: path.join(PROOF, `seo-guide-top-${vp.name}.png`) });
    await page.locator('section#agent-editor').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(PROOF, `seo-guide-section-${vp.name}.png`) });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: SEO[''].h1 })).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: path.join(PROOF, `seo-home-${vp.name}.png`) });
  }
});
