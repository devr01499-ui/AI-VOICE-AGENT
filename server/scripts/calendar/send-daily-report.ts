import { prisma } from '../../src/lib/prisma';
import { Resend } from 'resend';
import { logger } from '../../src/utils/logger';

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key_123');

async function sendDailyReports() {
  console.log('--- Generating Daily End-of-Day Reports ---');

  // Define "today" window (e.g., last 24 hours)
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  // Get all users who have agents
  const users = await prisma.user.findMany({
    include: {
      agents: true
    }
  });

  for (const user of users) {
    if (!user.email) continue;
    
    const agentIds = user.agents.map(a => a.id);
    if (agentIds.length === 0) continue;

    // Aggregate today's metrics
    const scheduledToday = await prisma.scheduledCall.findMany({
      where: {
        agentId: { in: agentIds },
        createdAt: { gte: startOfDay }
      }
    });

    if (scheduledToday.length === 0) continue; // No activity today, skip email to avoid spam

    const aiBookedCount = scheduledToday.filter(s => s.source === 'ai_booked').length;
    const manualBookedCount = scheduledToday.filter(s => s.source === 'manual').length;
    const batchBookedCount = scheduledToday.filter(s => s.source === 'batch').length;
    
    const completedCount = scheduledToday.filter(s => s.status === 'completed').length;
    const failedCount = scheduledToday.filter(s => s.status === 'failed').length;

    const htmlBody = `
      <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #4F46E5;">Claritiy Voice - Daily Activity Report</h2>
        <p>Here is the summary of your voice agents' scheduling activity for today (${startOfDay.toLocaleDateString()}):</p>
        
        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Scheduling Sources</h3>
          <ul style="list-style: none; padding: 0;">
            <li>🤖 <strong>AI Booked Follow-ups:</strong> ${aiBookedCount}</li>
            <li>👤 <strong>Manually Scheduled:</strong> ${manualBookedCount}</li>
            <li>📦 <strong>Batch Campaigns:</strong> ${batchBookedCount}</li>
          </ul>
        </div>

        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Execution Status</h3>
          <ul style="list-style: none; padding: 0;">
            <li>✅ <strong>Successfully Completed:</strong> ${completedCount}</li>
            <li>❌ <strong>Failed/Unanswered:</strong> ${failedCount}</li>
            <li>⏳ <strong>Pending/Upcoming:</strong> ${scheduledToday.length - completedCount - failedCount}</li>
          </ul>
        </div>

        <p style="font-size: 12px; color: #6B7280; text-align: center; margin-top: 40px;">
          This is an automated end-of-day report from your Claritiy Voice Dashboard.
        </p>
      </div>
    `;

    try {
      if (process.env.RESEND_API_KEY) {
        await resend.emails.send({
          from: 'Claritiy Voice <reports@claritiyvoice.com>',
          to: user.email,
          subject: 'Your Daily Claritiy Voice Activity Report',
          html: htmlBody,
        });
        console.log(`Sent report to ${user.email}`);
      } else {
        console.log(`[MOCK EMAIL] To: ${user.email} | AI Booked: ${aiBookedCount}`);
      }
    } catch (err: any) {
      logger.error(`Failed to send daily report to ${user.email}`, { error: err.message });
    }
  }

  console.log('--- Done Sending Reports ---');
}

sendDailyReports().catch(console.error);
