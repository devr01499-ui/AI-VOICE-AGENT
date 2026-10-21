import { test, expect } from '@playwright/test';

test.setTimeout(60000);

const VIEWPORTS = [
  { name: '360x640_mobile_compact', width: 360, height: 640 },
  { name: '390x844_mobile_standard', width: 390, height: 844 },
  { name: '768x1024_tablet_portrait', width: 768, height: 1024 },
  { name: '1024x768_tablet_landscape', width: 1024, height: 768 },
  { name: '1280x800_laptop', width: 1280, height: 800 },
  { name: '1440x900_desktop', width: 1440, height: 900 },
  { name: '1920x1080_fhd', width: 1920, height: 1080 },
  { name: '2560x1440_qhd', width: 2560, height: 1440 },
  { name: '3840x2160_4k_tv', width: 3840, height: 2160 },
];

const ROUTES = [
  { path: '/', label: 'Landing' },
  { path: '/pricing', label: 'Pricing' },
  { path: '/how-it-works', label: 'HowItWorks' },
  { path: '/security', label: 'Security' },
  { path: '/faq', label: 'FAQ' },
];

test.describe('Responsive Layout & Zero Horizontal Scroll Verification', () => {
  for (const vp of VIEWPORTS) {
    for (const route of ROUTES) {
      test(`Viewport ${vp.name} (${vp.width}x${vp.height}) on ${route.label} (${route.path})`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(route.path, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(200);

        // Verify zero horizontal page scroll
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        const innerWidth = await page.evaluate(() => window.innerWidth);

        expect(
          scrollWidth,
          `Horizontal scroll detected on ${route.label} at ${vp.width}x${vp.height}: scrollWidth ${scrollWidth} > innerWidth ${innerWidth}`
        ).toBeLessThanOrEqual(innerWidth + 1); // 1px rounding tolerance for fractional devicePixelRatio
      });
    }
  }
});
