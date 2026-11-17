import { test, expect, type Page, type Route } from '@playwright/test';
import { loginAsTestUser, stubBackend, json, ok, TEST_USER } from './helpers/dashboard';

/**
 * Issue B2 — notification bell: per-notification "Mark read" and "Delete", mark all read,
 * unread badge, and rollback when the server refuses an action.
 */

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

function seedNotifications() {
  return [
    { id: 'n-1', userId: TEST_USER.id, type: 'KYC_STATUS', title: 'KYC approved', message: 'Your documents were verified.', severity: 'info', isRead: false, metadata: {}, createdAt: minutesAgo(2) },
    { id: 'n-2', userId: TEST_USER.id, type: 'CALL_FAILED', title: 'Call failed', message: 'The call to +91 98765 43210 did not connect.', severity: 'error', isRead: false, metadata: {}, createdAt: minutesAgo(90) },
    { id: 'n-3', userId: null, type: 'ANNOUNCEMENT', title: 'Announcement', message: 'New voices are available.', severity: 'info', isRead: true, isAnnouncement: true, metadata: {}, createdAt: minutesAgo(60 * 30) },
  ];
}

/** Stateful fake of the notification API, so the list behaves like the real server. */
async function setup(page: Page, opts: { failDelete?: boolean; failRead?: boolean; width?: number } = {}) {
  let items = seedNotifications();
  await page.setViewportSize({ width: opts.width ?? 1440, height: opts.width && opts.width < 768 ? 844 : 900 });
  await loginAsTestUser(page);
  const seen = await stubBackend(page, {
    '/api/v2/user/notifications/mark-all-read': (route) => { items = items.map((n) => ({ ...n, isRead: true })); return ok(route, { markedAllRead: true }); },
    '/api/v2/user/notifications/clear-all': (route) => { items = items.filter((n) => !n.isRead); return ok(route, { cleared: true }); },
    '/api/v2/user/notifications/': (route: Route, req) => {
      const id = decodeURIComponent(req.url.split('/notifications/')[1].split('/')[0].split('?')[0]);
      if (req.method === 'DELETE') {
        if (opts.failDelete) return json(route, 500, { success: false, error: 'Failed to delete notification' });
        items = items.filter((n) => n.id !== id);
        return ok(route, { id, deleted: true });
      }
      if (opts.failRead) return json(route, 500, { success: false, error: 'Failed to mark notification as read' });
      items = items.map((n) => (n.id === id ? { ...n, isRead: true } : n));
      return ok(route, { id, isRead: true });
    },
    '/api/v2/user/notifications': (route) => ok(route, items),
  });
  await page.goto('/dashboard');
  await expect(page.getByTestId('notification-badge')).toHaveText('2', { timeout: 30_000 });
  await page.getByTestId('notification-bell').click();
  await expect(page.getByTestId('notification-panel')).toBeVisible();
  return { seen, current: () => items };
}

const item = (page: Page, title: string) => page.getByTestId('notification-item').filter({ hasText: title });

test('every notification has a Delete button; unread ones also have Mark read', async ({ page }) => {
  await setup(page);
  await expect(page.getByTestId('notification-item')).toHaveCount(3);
  for (const title of ['KYC approved', 'Call failed', 'Announcement']) {
    await expect(item(page, title).getByRole('button', { name: /Delete notification/ })).toBeVisible();
  }
  await expect(item(page, 'KYC approved').getByRole('button', { name: 'Mark read' })).toBeVisible();
  await expect(item(page, 'Announcement').getByRole('button', { name: 'Mark read' })).toHaveCount(0);
  await expect(item(page, 'Announcement')).toContainText('Announcement ·');
});

test('Mark read updates the item and the badge, and calls the right endpoint', async ({ page }) => {
  const { seen } = await setup(page);
  await item(page, 'KYC approved').getByRole('button', { name: 'Mark read' }).click();
  await expect(item(page, 'KYC approved').getByRole('button', { name: 'Mark read' })).toHaveCount(0);
  await expect(page.getByTestId('notification-badge')).toHaveText('1');
  expect(seen.some((r) => r.method === 'POST' && r.url.endsWith('/api/v2/user/notifications/n-1/read'))).toBe(true);
  // The panel stays open: marking read is not a navigation.
  await expect(page.getByTestId('notification-panel')).toBeVisible();
});

test('Delete removes the item and calls DELETE for that id only', async ({ page }) => {
  const { seen, current } = await setup(page);
  await item(page, 'Call failed').getByRole('button', { name: /Delete notification/ }).click();
  await expect(item(page, 'Call failed')).toHaveCount(0);
  await expect(page.getByTestId('notification-item')).toHaveCount(2);
  await expect(page.getByTestId('notification-badge')).toHaveText('1');
  expect(seen.filter((r) => r.method === 'DELETE').map((r) => r.url.split('/notifications/')[1])).toEqual(['n-2']);
  expect(current().map((n) => n.id)).toEqual(['n-1', 'n-3']);
});

test('a failed delete puts the notification back and explains why', async ({ page }) => {
  await setup(page, { failDelete: true });
  await item(page, 'Call failed').getByRole('button', { name: /Delete notification/ }).click();
  await expect(page.getByRole('alert')).toHaveText(/Could not delete that notification/);
  await expect(item(page, 'Call failed')).toHaveCount(1);
  await expect(page.getByTestId('notification-badge')).toHaveText('2');
});

test('a failed mark-read rolls back to unread', async ({ page }) => {
  await setup(page, { failRead: true });
  await item(page, 'KYC approved').getByRole('button', { name: 'Mark read' }).click();
  await expect(page.getByRole('alert')).toHaveText(/Could not mark that notification as read/);
  await expect(item(page, 'KYC approved').getByRole('button', { name: 'Mark read' })).toBeVisible();
  await expect(page.getByTestId('notification-badge')).toHaveText('2');
});

test('Mark all read clears the badge', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Mark all read' }).click();
  await expect(page.getByTestId('notification-badge')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mark read' })).toHaveCount(0);
});

test('deleting the last notification shows the empty state', async ({ page }) => {
  await setup(page);
  for (const title of ['KYC approved', 'Call failed', 'Announcement']) {
    await item(page, title).getByRole('button', { name: /Delete notification/ }).click();
    await expect(item(page, title)).toHaveCount(0);
  }
  await expect(page.getByText('All caught up!')).toBeVisible();
});

test('the panel fits a phone screen', async ({ page }, testInfo) => {
  await setup(page, { width: 390 });
  const box = await page.getByTestId('notification-panel').boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath('bell-390.png') });
});

test('nothing on the page shows through the open panel', async ({ page }) => {
  await setup(page, { width: 390 });
  const covered = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="notification-panel"]')!;
    const r = panel.getBoundingClientRect();
    const bad: string[] = [];
    for (let x = r.left + 4; x < r.right - 4; x += 12) {
      for (let y = r.top + 4; y < r.bottom - 4; y += 12) {
        const el = document.elementFromPoint(x, y);
        if (el && !panel.contains(el)) bad.push(`${Math.round(x)},${Math.round(y)} <${el.tagName.toLowerCase()}>`);
      }
    }
    return bad.slice(0, 5);
  });
  expect(covered).toEqual([]);
});
