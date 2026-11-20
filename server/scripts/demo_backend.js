require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Local demo backend for browser checks of the REAL API (not stubs): the production routers on the
 * TEST database, with a seeded workspace for the e2e test user. Only the Supabase token check is
 * replaced (the e2e session's JWT `sub` is the user). Usage:
 *   TEST_DATABASE_URL=... node scripts/demo_backend.js [port] [frontendOrigin]
 */
const crypto = require('crypto');
const { prisma } = require('../dist/lib/prisma');
const { buildApp, installAuthStub } = require('./lib/demoApp.cjs');

const port = Number(process.argv[2] || 54400);
const origin = process.argv[3] || 'http://localhost:5180';
const USER = { id: '00000000-0000-4000-8000-000000000001', email: 'e2e.user@example.org' };

function subOf(token) {
  try { return JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8')).sub; } catch { return null; }
}

async function seed() {
  const existing = await prisma.user.findUnique({ where: { id: USER.id } });
  if (existing) {
    // Fresh demo data every start: remove the previous run's workspace.
    await prisma.user.delete({ where: { id: USER.id } }).catch(() => {});
  }
  const u = USER.id;
  await prisma.user.create({ data: { id: u, email: USER.email, fullName: 'Asha Verma (Demo)', passwordHash: 'x', accountType: 'professional', callingBalanceMinutes: 2865, minutesRemainingSeconds: 2865 * 60, hasConsentedTerms: true, planExpiresAt: new Date(Date.now() + 25 * 86400000) } });
  const agent = await prisma.agent.create({ data: { userId: u, name: 'Lotus Dental Receptionist', status: 'active', agentType: 'prompt', systemPrompt: 'You are the receptionist of Lotus Dental, Pune. Book appointments politely in English or Hindi.', agentConfig: JSON.stringify({ callSettings: { recordingEnabled: false } }), direction: 'inbound' } });
  const agent2 = await prisma.agent.create({ data: { userId: u, name: 'COD Order Confirmation', status: 'active', agentType: 'prompt', systemPrompt: 'Confirm cash-on-delivery orders before dispatch.', agentConfig: '{}', direction: 'outbound' } });
  const number = await prisma.phoneNumber.create({ data: { userId: u, phoneNumber: '+918045670001', countryCode: 'IN', telephonyProvider: 'vobiz', status: 'active', kycStatus: 'verified', assignedAgentId: agent.id, region: 'Bengaluru' } }).catch(async () => prisma.phoneNumber.findFirst({ where: { phoneNumber: '+918045670001' } }));
  const outcomes = [['completed', 95, 'Interested'], ['completed', 140, 'Booked'], ['no_answer', 0, null], ['busy', 0, null], ['completed', 61, 'Not Interested'], ['failed', 0, null]];
  let i = 0;
  for (const [status, dur, label] of outcomes) {
    i++;
    const started = new Date(Date.now() - i * 3600000);
    const c = await prisma.call.create({ data: { userId: u, agentId: i % 2 ? agent.id : agent2.id, recipientPhoneNumber: `+91987654${String(3200 + i)}`, fromPhoneNumber: '+918045670001', callDirection: 'outbound', status, durationSeconds: dur, startTime: dur ? started : null, endTime: dur ? new Date(started.getTime() + dur * 1000) : null, createdAt: started, sentiment: label === 'Booked' ? 'positive' : 'neutral' } });
    if (dur) {
      await prisma.transcriptSegment.createMany({ data: [
        { callId: c.id, speaker: 'agent', content: 'Namaste! Lotus Dental se bol rahi hoon. How can I help you today?', startTime: 0, endTime: 3, sequenceNumber: 1 },
        { callId: c.id, speaker: 'user', content: 'I want to book a cleaning appointment for Saturday.', startTime: 4, endTime: 7, sequenceNumber: 2 },
        { callId: c.id, speaker: 'agent', content: 'Sure, Saturday 11 am is available. Shall I book it?', startTime: 8, endTime: 11, sequenceNumber: 3 },
      ] });
      await prisma.callResult.create({ data: { callId: c.id, workspaceId: u, agentId: c.agentId, resultLabel: label, confidence: 0.86, status: 'completed', score: 78, summary: 'Caller asked for a cleaning appointment.' } });
    }
  }
  await prisma.contact.createMany({ data: [
    { userId: u, phoneNumber: '+919876543201', name: 'Rahul Sharma', tags: JSON.stringify(['lead']) },
    { userId: u, phoneNumber: '+919876543202', name: 'Priya Nair', tags: JSON.stringify(['patient']) },
  ] });
  const batch = await prisma.batch.create({ data: { userId: u, agentId: agent2.id, name: 'Diwali COD confirmations', status: 'completed', totalRecipients: 2, completedCount: 2, consentConfirmed: true } });
  await prisma.batchRecipient.createMany({ data: [
    { batchId: batch.id, phoneNumber: '+919876543201', status: 'completed', attempts: 1 },
    { batchId: batch.id, phoneNumber: '+919876543202', status: 'failed', attempts: 3, lastErrorCode: 'NO_ANSWER' },
  ] });
  const kbText = 'Consultation fee is 800 rupees. Cleaning costs 1500 rupees.';
  await prisma.knowledgeBase.create({ data: { userId: u, name: 'Clinic fees.txt', contentText: kbText, sizeChars: kbText.length } }).catch(() => {});
  await prisma.alertRule.create({ data: { userId: u, name: 'High error rate', metric: 'error_rate', comparator: 'greater_than', thresholdValue: 20 } });
  await prisma.qaCohort.create({ data: { userId: u, name: 'This week' } });
  await prisma.scheduledCall.create({ data: { source: 'ai_booked', agentId: agent.id, phoneNumber: '+919876543201', scheduledAtUtc: new Date(Date.now() + 86400000), timezone: 'Asia/Kolkata', idempotencyKey: crypto.randomUUID() } });
  return { agent, number };
}

(async () => {
  installAuthStub(async (token) => (subOf(token) === USER.id ? USER : null));
  await seed();
  const app = buildApp({ corsOrigin: origin });
  app.listen(port, '127.0.0.1', () => console.log(`DEMO_BACKEND_READY http://127.0.0.1:${port}`));
})().catch((e) => { console.error(e); process.exit(1); });
