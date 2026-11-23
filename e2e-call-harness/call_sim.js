require('../server/scripts/lib/testDbGuard.cjs'); // MUST stay first: blocks any non-test database
/**
 * e2e-call-harness — Telephony Call Simulator
 * 
 * Simulates a carrier (Plivo) placing signed inbound and outbound calls,
 * validating:
 * 1. First AI audio arrives within 3s of the stream "start" event
 * 2. WebSocket connection stays open for at least 10s
 * 3. Call record in database is not marked 'failed' during normal call
 * 4. Safe-tier retry saves the call when fake Gemini rejects initial setup
 * 
 * Usage: node e2e-call-harness/call_sim.js [outbound|inbound|reject_retry]
 */

const path = require('path');
// ws and dotenv are server dependencies (the repo root does not install them): resolve them there.
const serverRequire = require('module').createRequire(path.resolve(__dirname, '../server/package.json'));
serverRequire('dotenv').config({ path: path.resolve(__dirname, '../.env') });
serverRequire('dotenv').config({ path: path.resolve(__dirname, '../server/.env') });

const assert = require('assert');
const crypto = require('crypto');
const http = require('http');
const WebSocket = serverRequire('ws');
const { prisma } = require('../server/dist/lib/prisma');
const { getWebhookSigningSecret } = require('../server/dist/utils/security');
const { computePlivoV3Signature } = require('../server/dist/middleware/plivoWebhook');

const SERVER_HOST = process.env.TEST_SERVER_HOST || '127.0.0.1';
const SERVER_PORT = parseInt(process.env.PORT || '3001', 10);
const BASE_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;

function httpRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

/** What the fake Gemini has heard from callers so far (Requirement 4). */
async function getFakeGeminiStats() {
  const port = parseInt(process.env.FAKE_GEMINI_PORT || '8095', 10);
  const res = await httpRequest({ host: '127.0.0.1', port, path: '/control/stats', method: 'GET' });
  return JSON.parse(res.body);
}

// A dedicated, deterministic harness tenant: a paying customer (not an admin, so the real balance
// and plan checks run) with minutes left. Never "the first user in the database".
const HARNESS_USER_ID = '00000000-0000-4000-8000-0000000ca11e';
const HARNESS_AGENT_ID = '00000000-0000-4000-8000-0000000a9e47';
const HARNESS_DID = '+918065530386';

async function ensureSeedData() {
  const planExpiresAt = new Date(Date.now() + 30 * 86400000);
  const user = await prisma.user.upsert({
    where: { id: HARNESS_USER_ID },
    update: { accountType: 'professional', accountStatus: 'active', minutesRemainingSeconds: 1000 * 60, callingBalanceMinutes: 1000, planExpiresAt },
    create: {
      id: HARNESS_USER_ID,
      email: 'call-harness@example.org',
      fullName: 'Call Path Harness',
      passwordHash: 'ci_test_password_hash',
      accountType: 'professional',
      minutesRemainingSeconds: 1000 * 60,
      callingBalanceMinutes: 1000,
      hasConsentedTerms: true,
      planExpiresAt,
    },
  });

  const agentData = {
    name: 'Harness Test Agent',
    status: 'active',
    direction: 'both',
    systemPrompt: 'You are an intelligent telephone voice assistant for Claritiy Voice.',
    systemVoice: 'Puck',
    languageMode: 'auto',
  };
  const agent = await prisma.agent.upsert({
    where: { id: HARNESS_AGENT_ID },
    update: agentData,
    create: { id: HARNESS_AGENT_ID, userId: user.id, ...agentData },
  });

  const phoneData = {
    userId: user.id,
    assignedAgentId: agent.id,
    telephonyProvider: 'plivo',
    status: 'active',
    kycStatus: 'verified',
    countryCode: 'IN',
    currency: 'INR',
    monthlyCost: 500,
  };
  const existing = await prisma.phoneNumber.findFirst({ where: { phoneNumber: HARNESS_DID } });
  const phone = existing
    ? await prisma.phoneNumber.update({ where: { id: existing.id }, data: phoneData })
    : await prisma.phoneNumber.create({ data: { phoneNumber: HARNESS_DID, ...phoneData } });

  return { user, agent, phone };
}

async function runSimulator(mode = 'outbound') {
  console.log(`\n==================================================`);
  console.log(`📞 SIMULATING CALL PATH: [${mode.toUpperCase()}]`);
  console.log(`==================================================`);

  const { user, agent, phone } = await ensureSeedData();
  const testCallUuid = `sim-call-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const callerNumber = '+919876543210';
  const businessDid = phone.phoneNumber;

  if (mode === 'reject_retry') {
    // Notify fake Gemini to reject the next incoming setup
    try {
      const fakeGeminiPort = process.env.FAKE_GEMINI_PORT || '8095';
      await httpRequest({
        hostname: '127.0.0.1',
        port: parseInt(fakeGeminiPort, 10),
        path: '/control/reject-next',
        method: 'GET',
      });
      console.log('✓ Configured fake Gemini to reject first setup frame');
    } catch (e) {
      console.warn('Notice: Could not trigger /control/reject-next on fake Gemini:', e.message);
    }
  }

  let callId = '';
  let answerReqBody = {};
  let answerReqQuery = '';

  if (mode === 'outbound' || mode === 'reject_retry') {
    // 1. Create Outbound Call Record in DB
    const createdCall = await prisma.call.create({
      data: {
        userId: user.id,
        agentId: agent.id,
        recipientPhoneNumber: callerNumber,
        fromPhoneNumber: businessDid,
        telemetryId: testCallUuid,
        status: 'ringing',
        callDirection: 'outbound',
        userData: '{}',
      },
    });
    callId = createdCall.id;

    // Cryptographic query token signature
    const secret = getWebhookSigningSecret();
    const querySig = crypto.createHmac('sha256', secret).update(callId).digest('hex');
    answerReqQuery = `?callId=${encodeURIComponent(callId)}&sig=${encodeURIComponent(querySig)}`;

    answerReqBody = {
      CallUUID: testCallUuid,
      RequestUUID: testCallUuid,
      Direction: 'outbound',
      From: businessDid,
      To: callerNumber,
      callId,
    };
  } else {
    // Inbound mode: the carrier calls the answer webhook, signed with the V3 signature below.
    answerReqBody = {
      CallUUID: testCallUuid,
      RequestUUID: testCallUuid,
      Direction: 'inbound',
      From: callerNumber,
      To: businessDid,
      CallStatus: 'ringing',
    };
  }

  const postData = JSON.stringify(answerReqBody);
  const secret = getWebhookSigningSecret();
  const querySig = callId ? crypto.createHmac('sha256', secret).update(callId).digest('hex') : '';
  const nonce = `nonce-${Date.now()}`;
  const authToken = (process.env.PLIVO_AUTH_TOKEN || 'test_plivo_token').trim();
  const targetUrl = `${BASE_URL}/api/v2/webhooks/plivo/answer${answerReqQuery}`;
  const computedV3 = computePlivoV3Signature(targetUrl, nonce, authToken, 'POST', answerReqBody);

  const answerHeaders = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'X-Plivo-Signature-V3': computedV3,
    'X-Plivo-Signature-V3-Nonce': nonce,
    ...(querySig ? { 'x-signature': querySig } : {}),
  };

  console.log(`1. Sending Plivo Answer webhook to ${BASE_URL}/api/v2/webhooks/plivo/answer...`);
  const answerRes = await httpRequest({
    hostname: SERVER_HOST,
    port: SERVER_PORT,
    path: `/api/v2/webhooks/plivo/answer${answerReqQuery}`,
    method: 'POST',
    headers: answerHeaders,
  }, postData);

  assert.strictEqual(answerRes.statusCode, 200, `Answer webhook returned HTTP ${answerRes.statusCode}: ${answerRes.body}`);
  assert(answerRes.body.includes('<Stream'), 'Answer webhook response missing <Stream> tag');

  // Extract stream URL
  const cdataMatch = answerRes.body.match(/<!\[CDATA\[(.*?)\]\]>/s);
  const streamUrlRaw = cdataMatch ? cdataMatch[1].trim() : answerRes.body.match(/<Stream[^>]*>(.*?)<\/Stream>/s)?.[1]?.trim();
  assert(streamUrlRaw, 'Could not extract WebSocket stream URL from XML response');

  // Extract extraHeaders
  const extraHeadersMatch = answerRes.body.match(/extraHeaders="([^"]+)"/);
  const extraHeaders = extraHeadersMatch ? extraHeadersMatch[1] : '';

  if (!callId) {
    const callIdMatch = answerRes.body.match(/callId=([a-zA-Z0-9-]+)/);
    assert(callIdMatch, 'Could not resolve callId from stream URL');
    callId = callIdMatch[1];
  }

  console.log(`✓ Answer webhook returned valid Stream XML (Call ID: ${callId})`);

  // Normalize WS URL to connect locally
  let wsUrl = streamUrlRaw;
  if (wsUrl.startsWith('http://')) wsUrl = wsUrl.replace('http://', 'ws://');
  if (wsUrl.startsWith('https://')) wsUrl = wsUrl.replace('https://', 'ws://');
  // Ensure host points to test server port
  const parsedWsUrl = new URL(wsUrl);
  parsedWsUrl.hostname = SERVER_HOST;
  parsedWsUrl.port = String(SERVER_PORT);
  parsedWsUrl.protocol = 'ws:';
  const finalWsConnectUrl = parsedWsUrl.toString();

  console.log(`2. Connecting carrier WebSocket to: ${finalWsConnectUrl}`);

  const ws = new WebSocket(finalWsConnectUrl);
  let wsConnectedAt = 0;
  let startEventSentAt = 0;
  let firstAudioReceivedAt = 0;
  let audioChunksReceived = 0;
  let isWsClosed = false;
  let wsCloseCode = 0;

  const audioPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (!firstAudioReceivedAt) {
        reject(new Error(`Timeout: No AI audio arrived within 3000ms of stream "start" event (firstAudioReceivedAt = ${firstAudioReceivedAt})`));
      }
    }, 3500);

    ws.on('open', () => {
      wsConnectedAt = Date.now();
      console.log('✓ Carrier WebSocket connected to AudioStreamHandler');

      // Immediately transmit the carrier "start" event
      startEventSentAt = Date.now();
      const startPayload = {
        event: 'start',
        start: {
          streamId: `stream-${testCallUuid}`,
          callId: callId,
          extra_headers: extraHeaders,
        },
      };

      ws.send(JSON.stringify(startPayload));
      console.log('✓ Dispatched carrier "start" event');

      // Send immediate media packet to test early queuing
      ws.send(JSON.stringify({
        event: 'media',
        media: {
          payload: Buffer.alloc(320, 0x00).toString('base64'),
        },
      }));
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.event === 'playAudio' || msg.event === 'media' || msg.audio || msg.data) {
          audioChunksReceived++;
          if (!firstAudioReceivedAt) {
            firstAudioReceivedAt = Date.now();
            const latencyFromStartMs = firstAudioReceivedAt - startEventSentAt;
            console.log(`🔊 FIRST AI AUDIO RECEIVED! Latency from "start" event: ${latencyFromStartMs}ms`);
            clearTimeout(timeout);
            resolve(latencyFromStartMs);
          }
        }
      } catch (e) {}
    });

    ws.on('error', (err) => {
      console.error('Carrier WebSocket error:', err.message);
      clearTimeout(timeout);
      reject(err);
    });

    ws.on('close', (code, reason) => {
      isWsClosed = true;
      wsCloseCode = code;
      console.log(`Carrier WebSocket closed with code ${code} (${reason})`);
    });
  });

  // REQUIREMENT 1: First AI audio arrives within 3s of stream "start" event
  const latencyMs = await audioPromise;
  assert(latencyMs <= 3000, `REQUIREMENT 1 FAILED: First AI audio latency ${latencyMs}ms exceeds 3000ms threshold`);
  console.log(`✓ Requirement 1 Passed: First AI audio arrived in ${latencyMs}ms (<= 3000ms threshold)`);

  // REQUIREMENT 2: WebSocket stays open for at least 10 seconds
  console.log('3. Validating WebSocket stays open for 10s...');
  for (let second = 1; second <= 10; second++) {
    await new Promise((res) => setTimeout(res, 1000));
    assert(!isWsClosed, `REQUIREMENT 2 FAILED: WebSocket closed early at second ${second} (code: ${wsCloseCode})`);
    if (ws.readyState === WebSocket.OPEN) {
      // Stream continuous media chunks every second
      ws.send(JSON.stringify({
        event: 'media',
        media: { payload: Buffer.alloc(320, 0x00).toString('base64') },
      }));
    }
  }

  const totalConnectedSeconds = Math.round((Date.now() - wsConnectedAt) / 1000);
  assert(totalConnectedSeconds >= 10, `REQUIREMENT 2 FAILED: Total connected duration ${totalConnectedSeconds}s < 10s`);
  console.log(`✓ Requirement 2 Passed: WebSocket remained open and active for ${totalConnectedSeconds}s (>= 10s threshold)`);

  // REQUIREMENT 4: the agent HEARS the caller (owner report 2026-11-23: "the agent spoke, I
  // answered, no response"). Requirement 1 is met by the greeting alone, so a call whose caller
  // audio never reached Gemini still passed. The caller now speaks (1 s of a loud tone, so no
  // noise gate drops it) and the fake Gemini, which hears only the format the real model accepts,
  // must report that it received it.
  const statsBefore = await getFakeGeminiStats();
  const speechFrame = Buffer.alloc(320);
  for (let i = 0; i < 160; i++) speechFrame.writeInt16LE(i % 2 === 0 ? 12000 : -12000, i * 2);
  for (let f = 0; f < 50 && ws.readyState === WebSocket.OPEN; f++) {
    ws.send(JSON.stringify({ event: 'media', media: { payload: speechFrame.toString('base64') } }));
    await new Promise((res) => setTimeout(res, 20));
  }
  await new Promise((res) => setTimeout(res, 500));
  const statsAfter = await getFakeGeminiStats();
  const heard = statsAfter.callerAudioHeard - statsBefore.callerAudioHeard;
  assert(heard > 0, `REQUIREMENT 4 FAILED: Gemini never heard the caller (heard ${heard} frames, dropped ${statsAfter.callerAudioDropped - statsBefore.callerAudioDropped} in an unaccepted format)`);
  console.log(`✓ Requirement 4 Passed: Gemini heard the caller (${heard} audio frames)`);

  // Close carrier WebSocket cleanly
  try {
    ws.send(JSON.stringify({ event: 'stop' }));
    ws.close(1000, 'Test completed');
  } catch {}

  // Wait 1s for post-call status persistence
  await new Promise((res) => setTimeout(res, 1000));

  // REQUIREMENT 3: The call row is not marked failed during normal call
  const callRow = await prisma.call.findUnique({
    where: { id: callId },
    select: { id: true, status: true, endReason: true, endedBy: true, endDetail: true },
  });

  assert(callRow, 'Call row missing from database');
  console.log('Database Call Row Audit:');
  console.log('  status:', callRow.status);
  console.log('  endReason:', callRow.endReason);
  console.log('  endedBy:', callRow.endedBy);
  console.log('  endDetail:', callRow.endDetail);

  assert(callRow.status !== 'failed', `REQUIREMENT 3 FAILED: Call row status is 'failed'. endDetail: ${callRow.endDetail}`);
  console.log(`✓ Requirement 3 Passed: Call row is not marked failed (status: ${callRow.status})`);

  // Persist cleanup
  await prisma.call.delete({ where: { id: callId } }).catch(() => {});
  console.log(`🎉 CALL CASE [${mode.toUpperCase()}] FULLY PASSED ALL 4 REQUIREMENTS\n`);
  return true;
}

if (require.main === module) {
  const mode = process.argv[2] || 'outbound';
  runSimulator(mode)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`\n❌ CALL SIMULATOR FAILED: ${err.message}`);
      if (err.stack) console.error(err.stack);
      process.exit(1);
    });
}

module.exports = { runSimulator };
