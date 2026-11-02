/**
 * Claritiy Voice — Notification System & Event Types Test Suite
 *
 * Verifies:
 * 1. CALL_FAILED creates high-severity notification with call metadata.
 * 2. BALANCE_LOW (< 10%) creates warning notification with balance details.
 * 3. KYC_STATUS creates notification for approval / rejection.
 * 4. BATCH_COMPLETED creates notification with total and failure count.
 * 5. getForUser returns unread notifications newest first.
 * 6. markAsRead updates isRead state.
 * 7. markAllAsRead marks all user notifications as read.
 * 8. clearAll removes resolved notifications.
 *
 * Run: npx tsx scripts/test_notification_events.ts
 */

import assert from 'assert';
import dotenv from 'dotenv';
dotenv.config();

import { NotificationService } from '../src/services/NotificationService';
import { prisma } from '../src/lib/prisma';

let totalTests = 0;
let passedTests = 0;

function it(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res.then(() => {
        passedTests++;
        console.log(`  \x1b[32m✔ PASS\x1b[0m: ${name}`);
      }).catch((err) => {
        console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${name}`, err);
      });
    } else {
      passedTests++;
      console.log(`  \x1b[32m✔ PASS\x1b[0m: ${name}`);
    }
  } catch (err) {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${name}`, err);
  }
}

async function main() {
  console.log('\n=== NOTIFICATION EVENTS & SYSTEM INTEGRATION TEST SUITE ===\n');

  const testUserId = `test_user_notif_${Date.now()}`;

  // Cleanup helper
  const cleanup = async () => {
    try {
      await prisma.systemAlert.deleteMany({ where: { userId: testUserId } });
    } catch {}
  };

  await cleanup();

  try {
    // 1. CALL_FAILED event
    let callFailedNotifId = '';
    await it('1. CALL_FAILED event creates notification with deep-link metadata', async () => {
      const alert = await NotificationService.createNotification({
        userId: testUserId,
        type: 'CALL_FAILED',
        title: 'Call Delivery Failed',
        message: 'Outbound call to +919876543210 terminated abnormally (carrier_error)',
        severity: 'error',
        metadata: { callId: 'call_123', recipient: '+919876543210', route: 'calls' }
      });
      assert(alert, 'Alert must be created in DB');
      assert.strictEqual(alert.type, 'CALL_FAILED');
      assert.strictEqual(alert.severity, 'error');
      callFailedNotifId = alert.id;
    });

    // 2. BALANCE_LOW event
    await it('2. BALANCE_LOW event creates warning notification (< 10% threshold)', async () => {
      const alert = await NotificationService.createNotification({
        userId: testUserId,
        type: 'BALANCE_LOW',
        title: 'Account Credits Low',
        message: 'Your remaining balance is below 10% (15 credits remaining). Top up to prevent call disruption.',
        severity: 'warning',
        metadata: { remainingCredits: 15, route: 'settings' }
      });
      assert(alert);
      assert.strictEqual(alert.type, 'BALANCE_LOW');
      assert.strictEqual(alert.severity, 'warning');
    });

    // 3. KYC_STATUS event
    await it('3. KYC_STATUS event creates verification status notification', async () => {
      const alert = await NotificationService.createNotification({
        userId: testUserId,
        type: 'KYC_STATUS',
        title: 'KYC Verification Approved',
        message: 'Your enterprise documentation has been verified. Outbound calling is fully unlocked.',
        severity: 'info',
        metadata: { kycStatus: 'approved', route: 'kyc' }
      });
      assert(alert);
      assert.strictEqual(alert.type, 'KYC_STATUS');
    });

    // 4. BATCH_COMPLETED event
    await it('4. BATCH_COMPLETED event creates campaign summary with failure metrics', async () => {
      const alert = await NotificationService.createNotification({
        userId: testUserId,
        type: 'BATCH_COMPLETED',
        title: 'Campaign Completed',
        message: 'Batch "Q4 Outbound Outreach" finished: 180 connected, 12 failed.',
        severity: 'info',
        metadata: { batchId: 'batch_789', connected: 180, failed: 12, route: 'batches' }
      });
      assert(alert);
      assert.strictEqual(alert.type, 'BATCH_COMPLETED');
    });

    // 5. getForUser returns unread items
    await it('5. getForUser returns user notifications sorted newest first', async () => {
      const userNotifs = await NotificationService.getForUser(testUserId);
      assert.strictEqual(userNotifs.length, 4);
      assert.strictEqual(userNotifs[0].type, 'BATCH_COMPLETED', 'Newest notification must be first');
      assert.strictEqual(userNotifs.filter(n => !n.isRead).length, 4, 'All 4 notifications start unread');
    });

    // 6. markAsRead updates single item
    await it('6. markAsRead marks single notification as read', async () => {
      await NotificationService.markAsRead(callFailedNotifId, testUserId);
      const userNotifs = await NotificationService.getForUser(testUserId);
      const target = userNotifs.find(n => n.id === callFailedNotifId);
      assert(target?.isRead === true, 'Target notification must be marked as read');
      assert.strictEqual(userNotifs.filter(n => !n.isRead).length, 3);
    });

    // 7. markAllAsRead marks all items read
    await it('7. markAllAsRead marks all user notifications as read', async () => {
      await NotificationService.markAllAsRead(testUserId);
      const userNotifs = await NotificationService.getForUser(testUserId);
      assert.strictEqual(userNotifs.filter(n => !n.isRead).length, 0);
    });

    // 8. clearAll deletes read notifications
    await it('8. clearAll deletes all resolved notifications for user', async () => {
      await NotificationService.clearAll(testUserId);
      const userNotifs = await NotificationService.getForUser(testUserId);
      assert.strictEqual(userNotifs.length, 0, 'All cleared notifications must be deleted');
    });

  } finally {
    await cleanup();
  }

  console.log(`\n=== RESULT: ${passedTests}/${totalTests} PASSED ===\n`);
  process.exit(passedTests === totalTests ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

