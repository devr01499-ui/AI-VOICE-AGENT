require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Local demo backend for browser checks of the REAL API (not stubs): the production routers on the
 * TEST database, with a seeded workspace for the e2e test user. Only the Supabase token check is
 * replaced (the e2e session's JWT `sub` is the user). The same seed feeds the dashboard guide's
 * screenshots (Frontend/scripts/guide-screenshots.cjs), so everything in it is fictional: business
 * names, people and phone numbers (+91 90000 xxxxx placeholders, not real subscribers).
 * Usage:
 *   TEST_DATABASE_URL=... node scripts/demo_backend.js [port] [frontendOrigin]
 */
const crypto = require('crypto');
const { prisma } = require('../dist/lib/prisma');
const { buildApp, installAuthStub } = require('./lib/demoApp.cjs');

const port = Number(process.argv[2] || 54400);
const origin = process.argv[3] || 'http://localhost:5180';
const USER = { id: '00000000-0000-4000-8000-000000000001', email: 'e2e.user@example.org', fullName: 'Asha Verma' };

function subOf(token) {
  try { return JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8')).sub; } catch { return null; }
}

/** Placeholder caller numbers: +91 90000 00001, +91 90000 00002, ... */
const caller = (n) => `+9190000${String(n).padStart(5, '0')}`;
const BUSINESS_NUMBER = '+918000000101';

async function seed() {
  const existing = await prisma.user.findUnique({ where: { id: USER.id } });
  if (existing) {
    // Fresh demo data every start: remove the previous run's workspace.
    await prisma.user.delete({ where: { id: USER.id } }).catch(() => {});
  }
  const u = USER.id;
  await prisma.user.create({ data: { id: u, email: USER.email, fullName: USER.fullName, passwordHash: 'x', accountType: 'professional', callingBalanceMinutes: 2865, minutesRemainingSeconds: 2865 * 60, hasConsentedTerms: true, planExpiresAt: new Date(Date.now() + 25 * 86400000) } });
  const agent = await prisma.agent.create({ data: { userId: u, name: 'Lotus Dental Receptionist', status: 'active', agentType: 'prompt', systemPrompt: 'You are Priya, the receptionist of Lotus Dental Clinic in Pune. Greet callers warmly in English or Hindi, answer questions about timings and fees from the knowledge base, and book appointments on the clinic calendar. Never give medical advice; offer a call-back from the dentist instead.', agentConfig: JSON.stringify({ callSettings: { recordingEnabled: false } }), direction: 'inbound' } });
  const agent2 = await prisma.agent.create({ data: { userId: u, name: 'COD Order Confirmation', status: 'active', agentType: 'prompt', systemPrompt: 'You call customers of Kesar Naturals who chose cash on delivery. Confirm the order, the delivery address and a good time to deliver, in Hindi or English.', agentConfig: '{}', direction: 'outbound' } });
  await prisma.agent.create({ data: { userId: u, name: 'EMI Due-Date Reminder', status: 'draft', agentType: 'prompt', systemPrompt: 'Remind borrowers politely that their EMI is due in three days. Verify identity before sharing any amount.', agentConfig: '{}', direction: 'outbound' } });
  const number = await prisma.phoneNumber.create({ data: { userId: u, phoneNumber: BUSINESS_NUMBER, countryCode: 'IN', telephonyProvider: 'vobiz', status: 'active', kycStatus: 'verified', assignedAgentId: agent.id, region: 'Pune' } }).catch(async () => prisma.phoneNumber.findFirst({ where: { phoneNumber: BUSINESS_NUMBER } }));

  // Two weeks of calls, so the analytics chart and call history look like a real fortnight.
  const outcomes = [['completed', 95, 'Booked'], ['completed', 140, 'Interested'], ['no_answer', 0, null], ['completed', 61, 'Not Interested'], ['busy', 0, null], ['completed', 182, 'Booked'], ['completed', 74, 'Callback Requested'], ['failed', 0, null]];
  let i = 0;
  for (let day = 13; day >= 0; day--) {
    const perDay = 2 + ((day * 7) % 4);
    for (let k = 0; k < perDay; k++) {
      i++;
      const [status, dur, label] = outcomes[i % outcomes.length];
      const inbound = i % 3 === 0;
      const started = new Date(Date.now() - day * 86400000 - (k + 1) * 3600000);
      const agentId = inbound ? agent.id : agent2.id;
      // Inbound: the caller dials the business number (as InboundCallService stores it).
      const c = await prisma.call.create({ data: { userId: u, agentId, recipientPhoneNumber: inbound ? BUSINESS_NUMBER : caller(i), fromPhoneNumber: inbound ? caller(i) : BUSINESS_NUMBER, callDirection: inbound ? 'inbound' : 'outbound', status, durationSeconds: dur, startTime: dur ? started : null, endTime: dur ? new Date(started.getTime() + dur * 1000) : null, createdAt: started, sentiment: label === 'Booked' ? 'positive' : 'neutral', endReason: dur ? 'completed' : null } });
      if (dur) {
        await prisma.transcriptSegment.createMany({ data: inbound ? [
          { callId: c.id, speaker: 'agent', content: 'Namaste! Lotus Dental Clinic se Priya bol rahi hoon. How can I help you today?', startTime: 0, endTime: 4, sequenceNumber: 1 },
          { callId: c.id, speaker: 'user', content: 'Hi, I want to book a cleaning appointment for Saturday.', startTime: 5, endTime: 8, sequenceNumber: 2 },
          { callId: c.id, speaker: 'agent', content: 'Sure. Saturday at 11 am is free with Dr. Mehta. Shall I book it in your name?', startTime: 9, endTime: 13, sequenceNumber: 3 },
          { callId: c.id, speaker: 'user', content: 'Yes please, the name is Rahul.', startTime: 14, endTime: 16, sequenceNumber: 4 },
          { callId: c.id, speaker: 'agent', content: 'Done, Rahul. You are booked for Saturday at 11 am. See you then!', startTime: 17, endTime: 21, sequenceNumber: 5 },
        ] : [
          { callId: c.id, speaker: 'agent', content: 'Namaste, main Kesar Naturals se bol rahi hoon. Aapne cash on delivery order kiya tha, kya main confirm kar sakti hoon?', startTime: 0, endTime: 5, sequenceNumber: 1 },
          { callId: c.id, speaker: 'user', content: 'Haan, confirm hai. Please deliver after 6 pm.', startTime: 6, endTime: 9, sequenceNumber: 2 },
          { callId: c.id, speaker: 'agent', content: 'Theek hai, delivery 6 baje ke baad. Address Kothrud, Pune hi rahega na?', startTime: 10, endTime: 14, sequenceNumber: 3 },
          { callId: c.id, speaker: 'user', content: 'Yes, same address.', startTime: 15, endTime: 16, sequenceNumber: 4 },
        ] });
        await prisma.callResult.create({ data: { callId: c.id, workspaceId: u, agentId, resultLabel: label, confidence: 0.86, status: 'completed', score: 70 + (i % 25), summary: inbound ? 'Caller booked a cleaning appointment for Saturday 11 am.' : 'Customer confirmed the COD order and asked for delivery after 6 pm.' } });
      }
    }
  }
  await prisma.contact.createMany({ data: [
    { userId: u, phoneNumber: caller(1), name: 'Rahul Sharma', tags: JSON.stringify(['patient']) },
    { userId: u, phoneNumber: caller(2), name: 'Priya Nair', tags: JSON.stringify(['patient', 'vip']) },
    { userId: u, phoneNumber: caller(3), name: 'Imran Shaikh', tags: JSON.stringify(['cod-customer']) },
    { userId: u, phoneNumber: caller(4), name: 'Meera Joshi', tags: JSON.stringify(['cod-customer']) },
  ] });
  const batch = await prisma.batch.create({ data: { userId: u, agentId: agent2.id, name: 'Diwali COD confirmations', status: 'completed', totalRecipients: 2, completedCount: 2, consentConfirmed: true } });
  await prisma.batchRecipient.createMany({ data: [
    { batchId: batch.id, phoneNumber: caller(3), status: 'completed', attempts: 1 },
    { batchId: batch.id, phoneNumber: caller(4), status: 'failed', attempts: 3, lastErrorCode: 'NO_ANSWER' },
  ] });
  const kbText = 'Lotus Dental Clinic, Kothrud, Pune. Open Monday to Saturday, 10 am to 7 pm. Consultation fee is 800 rupees. Teeth cleaning costs 1,500 rupees. Root canal treatment starts at 6,000 rupees.';
  await prisma.knowledgeBase.create({ data: { userId: u, name: 'Clinic timings and fees.txt', contentText: kbText, sizeChars: kbText.length } }).catch(() => {});
  await prisma.alertRule.create({ data: { userId: u, name: 'Failed calls above 20%', metric: 'error_rate', comparator: 'greater_than', thresholdValue: 20 } });
  await prisma.qaCohort.create({ data: { userId: u, name: 'This week\'s receptionist calls' } });
  await prisma.scheduledCall.create({ data: { source: 'ai_booked', agentId: agent.id, phoneNumber: caller(1), scheduledAtUtc: new Date(Date.now() + 86400000), timezone: 'Asia/Kolkata', idempotencyKey: crypto.randomUUID() } });
  return { agent, number };
}

(async () => {
  installAuthStub(async (token) => (subOf(token) === USER.id ? USER : null));
  await seed();
  const app = buildApp({ corsOrigin: origin });
  app.listen(port, '127.0.0.1', () => console.log(`DEMO_BACKEND_READY http://127.0.0.1:${port}`));
})().catch((e) => { console.error(e); process.exit(1); });
