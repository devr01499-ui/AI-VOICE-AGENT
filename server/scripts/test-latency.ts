import { config } from 'dotenv';
config();
import { prisma } from '../src/lib/prisma';
import { ADMIN_EMAIL } from '../src/config/constants';
import { GeminiLiveProvider } from '../src/providers/gemini/GeminiLiveProvider';
import { CallError } from '../src/utils/CallError';

async function runTest() {
  console.log("=== Setting up test data for latency measurement ===");
  const adminId = '1e69187e-82d5-4166-929f-4bbba90e5304';
  
  await prisma.user.upsert({
    where: { id: adminId },
    update: { email: ADMIN_EMAIL, callingBalanceMinutes: 100 },
    create: {
      id: adminId,
      email: ADMIN_EMAIL,
      fullName: 'Admin',
      passwordHash: 'dummy',
      callingBalanceMinutes: 100
    }
  });

  const agentId = 'latency-test-agent';
  await prisma.agent.upsert({
    where: { id: agentId },
    update: { systemVoice: 'Puck', temperature: 0.7, languageMode: 'auto' },
    create: {
      id: agentId,
      name: 'Latency Test Agent',
      systemPrompt: 'You are a helpful assistant.',
      voiceName: 'Puck',
      model: 'models/gemini-2.5-flash-native-audio-latest',
      userId: adminId,
      systemVoice: 'Puck',
      temperature: 0.7,
      languageMode: 'auto'
    }
  });

  const kbId = 'latency-test-kb';
  await prisma.knowledgeBase.upsert({
    where: { id: kbId },
    update: {},
    create: {
      id: kbId,
      userId: adminId,
      name: 'Test KB',
      contentText: 'Dummy test content for latency test',
      sizeChars: 100
    }
  });

  // Link agent and kb to enable the search_knowledge_base tool
  const linkId = `${agentId}_${kbId}`;
  await prisma.agentKnowledgeBase.upsert({
    where: { id: linkId },
    update: {},
    create: {
      id: linkId,
      agentId: agentId,
      kbId: kbId
    }
  });

  // Create a dummy KB chunk to be found by vector search
  // Assuming pgvector is installed and kb_chunks table exists.
  try {
    const { getEmbedding } = await import('../src/utils/embedding');
    const vec = await getEmbedding("This is a dummy fact to test latency");
    await prisma.$executeRawUnsafe(
      `INSERT INTO "kb_chunks" (id, "kb_id", content, embedding) VALUES ($1, $2, $3, cast($4 as vector)) ON CONFLICT (id) DO NOTHING`,
      'dummy-chunk-id', kbId, 'This is a dummy fact to test latency', `[${vec.join(',')}]`
    );
  } catch (err: any) {
    console.warn("Could not insert vector chunk (maybe missing pgvector?), continuing anyway:", err.message);
  }

  const callId = 'test-call-latency-123';
  await prisma.call.upsert({
    where: { id: callId },
    update: { agentId, userId: adminId },
    create: {
      id: callId,
      agentId,
      userId: adminId,
      recipientPhoneNumber: '+10000000000',
      fromPhoneNumber: '+10000000001',
      userData: '{}'
    }
  });

  console.log("=== Setup Complete. Initializing Gemini Live Provider ===");
  
  const provider = new GeminiLiveProvider();
  
  try {
    console.log("Connecting...");
    const { sessionId } = await provider.createSession(
      {
        callId,
        agentId,
        userId: adminId,
        model: 'gemini-2.5-flash-native-audio-latest',
        voice: 'Puck',
        instructions: 'You are a test bot. Please use your search_knowledge_base tool to answer the following query: What is the dummy fact to test latency?'
      },
      {
        onAudioDelta: (sid, data) => {
          // Logged inside provider
        },
        onTranscriptDelta: (sid, text, isFinal, isUser) => {
          // console.log(`Transcript [User=${isUser}]: ${text}`);
        },
        onSpeechStopped: (sid) => {},
        onResponseDone: (sid) => {
          console.log(`[LATENCY_TEST] Response Done for ${sid}`);
          setTimeout(() => {
            provider.closeSession(sid).then(() => {
              prisma.$disconnect();
              process.exit(0);
            });
          }, 1000);
        },
        onFunctionCall: (sid, callId, name, args) => {
          console.log(`[LATENCY_TEST] onFunctionCall (unexpected if KB is handled internally): ${name}`);
        },
        onError: (sid, err) => {
          console.error(`Error in session ${sid}:`, err);
        }
      }
    );

    console.log(`=== Session created: ${sessionId}. Sending test prompt to trigger KB search... ===`);
    
    // Send a user turn manually using triggerGreeting to simulate user speech that requires KB
    provider.triggerGreeting(sessionId, "Please search your knowledge base to find out what the dummy fact to test latency is.");

    // The process will exit onResponseDone.
  } catch (err: any) {
    console.error("Test Failed:", err);
    prisma.$disconnect();
  }
}

runTest();
