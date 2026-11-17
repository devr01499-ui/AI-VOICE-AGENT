import { test, expect, type Page } from '@playwright/test';
import { loginAsTestUser, stubBackend } from './helpers/dashboard';

/**
 * Issue B1 — Agents → Create agent / templates pop-up.
 *  - No text may spill outside its card, at any width.
 *  - The pop-up must use the available screen width instead of leaving wide blank margins.
 */

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'wide', width: 1920, height: 1080 },
] as const;

async function openCreateAgent(page: Page) {
  await loginAsTestUser(page);
  await stubBackend(page);
  await page.goto('/dashboard');
  await page.getByRole('button', { name: /Create an Agent/ }).click({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Create agent' })).toBeVisible();
  await expect(page.locator('[data-testid="template-card"]').first()).toBeVisible();
}

/** Returns every element inside a template card whose content is wider or taller than the box that holds it. */
async function findOverflow(page: Page) {
  return page.evaluate(() => {
    const problems: string[] = [];
    const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="template-card"]'));
    for (const card of cards) {
      const cardBox = card.getBoundingClientRect();
      const label = (card.querySelector('[data-testid="template-name"]')?.textContent || '').trim().slice(0, 40);
      for (const el of Array.from(card.querySelectorAll<HTMLElement>('*'))) {
        if (!el.textContent || !el.textContent.trim()) continue;
        const box = el.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;
        const outside = box.left < cardBox.left - 1 || box.right > cardBox.right + 1 || box.top < cardBox.top - 1 || box.bottom > cardBox.bottom + 1;
        if (outside) problems.push(`"${label}": <${el.tagName.toLowerCase()}> sticks out of its card`);
      }
      // A card must never be wider than its content can wrap in.
      if (card.scrollWidth > card.clientWidth + 1) problems.push(`"${label}": card content is wider than the card`);
    }
    return { cards: cards.length, problems: Array.from(new Set(problems)) };
  });
}

for (const vp of VIEWPORTS) {
  test(`template cards keep all text inside the box at ${vp.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await openCreateAgent(page);

    // Hovering a card opens the preview panel on desktop, which is when cards get narrowest.
    if (vp.width >= 1024) await page.locator('[data-testid="template-card"]').nth(2).hover();

    const result = await findOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`templates-${vp.name}.png`) });
    expect(result.cards).toBeGreaterThan(5);
    expect(result.problems).toEqual([]);

    const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(pageOverflow).toBeLessThanOrEqual(1);
  });
}

for (const vp of VIEWPORTS.filter((v) => v.width >= 1280)) {
  test(`create-agent pop-up uses the available width at ${vp.width}px`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await openCreateAgent(page);
    // offsetWidth is the laid-out width; it ignores the pop-up's zoom-in animation, which made a
    // bounding-box measurement read ~0.1% small if taken a moment too early.
    const dialogWidth = await page.locator('[data-testid="create-agent-dialog"]').evaluate((el) => (el as HTMLElement).offsetWidth);
    // At least 90% of the screen width (up to a readable maximum of 1760px).
    const expected = Math.min(vp.width * 0.9, 1760 * 0.98);
    expect(dialogWidth).toBeGreaterThanOrEqual(expected);
    // And template cards stay comfortably readable.
    const cardWidth = await page.locator('[data-testid="template-card"]').first().evaluate((el) => (el as HTMLElement).offsetWidth);
    expect(cardWidth).toBeGreaterThanOrEqual(220);
  });
}

test('the side menu shows the signed-in customer\'s own workspace name', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsTestUser(page);
  await stubBackend(page);
  await page.goto('/dashboard');
  await expect(page.getByTestId('workspace-name')).toHaveText("E2E's Workspace", { timeout: 30_000 });
  await expect(page.getByText("Rohit's Workspace")).toHaveCount(0);
});

test('on a phone the side menu starts closed so the page is usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsTestUser(page);
  await stubBackend(page);
  await page.goto('/dashboard');
  const create = page.getByRole('button', { name: /Create an Agent/ });
  await expect(create).toBeVisible({ timeout: 30_000 });
  // trial: true checks the button can actually receive a tap (nothing is covering it).
  await create.click({ trial: true, timeout: 5_000 });
});
