require('./lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * Phase 4 (audit A8): the agent's "Redact personal data" choices are applied when transcripts are
 * saved (before, nothing read them), with Indian formats (Aadhaar, PAN, +91 mobiles).
 *
 * Production TranscriptRepository and CallService against the local TEST database.
 * Run: npm run test:pii-settings   (part of npm run test:security)
 */
const assert = require('assert');
const crypto = require('crypto');
const { prisma } = require('../dist/lib/prisma');
const { applyPiiRedaction, TranscriptRepository } = require('../dist/repositories/TranscriptRepository');
const { CallService } = require('../dist/services/CallService');

let total = 0;
let passed = 0;
async function test(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}\n    ${err.message}`);
  }
}

const SAMPLE = 'Call me on +91 98765 43210 or 9876543210, mail asha.verma@example.org, Aadhaar 1234 5678 9012, PAN ABCDE1234F, card 4111 1111 1111 1111.';

async function main() {
  console.log('\n--- PII REDACTION SETTINGS (A8) ---');

  await test('each category redacts its own data and nothing else', async () => {
    const onlyEmail = applyPiiRedaction(SAMPLE, ['email']);
    assert.ok(onlyEmail.includes('[REDACTED EMAIL]'));
    assert.ok(onlyEmail.includes('98765 43210') && onlyEmail.includes('ABCDE1234F'));
    const all = applyPiiRedaction(SAMPLE, ['phone', 'email', 'aadhaar', 'pan', 'credit_card']);
    for (const leak of ['98765', '9876543210', 'asha.verma', '1234 5678 9012', 'ABCDE1234F', '4111']) {
      assert.ok(!all.includes(leak), `"${leak}" still present: ${all}`);
    }
    for (const tag of ['[REDACTED PHONE]', '[REDACTED EMAIL]', '[REDACTED AADHAAR]', '[REDACTED PAN]', '[REDACTED CARD]']) assert.ok(all.includes(tag), `${tag} missing`);
  });

  await test('Aadhaar is not mistaken for a phone number, and ordinary text is untouched', async () => {
    assert.strictEqual(applyPiiRedaction('Aadhaar 1234 5678 9012', ['phone', 'aadhaar']), 'Aadhaar [REDACTED AADHAAR]');
    assert.strictEqual(applyPiiRedaction('Your appointment is at 10:30 on 12 March for 2 people.', ['phone', 'email', 'aadhaar', 'pan', 'credit_card']), 'Your appointment is at 10:30 on 12 March for 2 people.');
  });

  const owner = crypto.randomUUID();
  await prisma.user.create({ data: { id: owner, email: `${owner}@example.org`, fullName: 'PII Test', passwordHash: 'x' } });
  const mkAgent = (cfg, flag = false) => prisma.agent.create({ data: { userId: owner, name: 'PII', agentConfig: JSON.stringify(cfg), isPiiRedactionEnabled: flag } });
  const mkCall = (agentId) => prisma.call.create({ data: { userId: owner, agentId, recipientPhoneNumber: '+919876543210', status: 'in_progress' } });

  await test('transcripts are redacted BEFORE they are stored, per the agent\'s choices', async () => {
    const agent = await mkAgent({ securityFallback: { piiRedaction: ['phone', 'aadhaar'] } }, true);
    const call = await mkCall(agent.id);
    await TranscriptRepository.addSegment({ callId: call.id, speaker: 'user', content: SAMPLE, startTime: 0 });
    const stored = await prisma.transcriptSegment.findFirst({ where: { callId: call.id } });
    assert.ok(!stored.content.includes('98765') && !stored.content.includes('1234 5678 9012'), stored.content);
    assert.ok(stored.content.includes('asha.verma@example.org'), 'email was not chosen, so it stays');
  });

  await test('an agent without redaction stores the transcript as spoken', async () => {
    const agent = await mkAgent({});
    const call = await mkCall(agent.id);
    await TranscriptRepository.addSegment({ callId: call.id, speaker: 'user', content: SAMPLE, startTime: 0 });
    const stored = await prisma.transcriptSegment.findFirst({ where: { callId: call.id } });
    assert.strictEqual(stored.content, SAMPLE);
  });

  await test('older agents with only the on/off switch get everything redacted', async () => {
    const agent = await mkAgent({}, true);
    const call = await mkCall(agent.id);
    await TranscriptRepository.addSegment({ callId: call.id, speaker: 'user', content: SAMPLE, startTime: 0 });
    const stored = await prisma.transcriptSegment.findFirst({ where: { callId: call.id } });
    assert.ok(!stored.content.includes('98765') && !stored.content.includes('asha.verma'));
  });

  await test('reading a transcript also applies the categories (covers older unredacted rows)', async () => {
    const agent = await mkAgent({ securityFallback: { piiRedaction: ['email'] } }, true);
    const call = await mkCall(agent.id);
    await prisma.transcriptSegment.create({ data: { callId: call.id, speaker: 'user', content: SAMPLE, startTime: 0, sequenceNumber: 1 } });
    const segments = await CallService.getCallTranscript(call.id);
    assert.ok(segments[0].content.includes('[REDACTED EMAIL]'));
    assert.ok(segments[0].content.includes('98765 43210'));
  });

  await prisma.transcriptSegment.deleteMany({ where: { call: { userId: owner } } });
  await prisma.call.deleteMany({ where: { userId: owner } });
  await prisma.agent.deleteMany({ where: { userId: owner } });
  await prisma.user.deleteMany({ where: { id: owner } });
  console.log(`\nPII REDACTION SETTINGS: ${passed === total ? 'PASS' : 'FAIL'} — ${passed}/${total} tests passed\n`);
  await prisma.$disconnect().catch(() => {});
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error in PII settings tests:', err);
  process.exit(1);
});
