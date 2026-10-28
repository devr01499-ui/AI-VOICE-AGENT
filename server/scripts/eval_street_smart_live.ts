/**
 * Claritiy Voice — Live & Mock Evaluation Runner for Street-Smart Agents
 * 
 * Supports:
 * 1. CI Mock Mode:
 *    - EVAL_MOCK=bad must FAIL (catches known robotic failures)
 *    - EVAL_MOCK=good must PASS (proves golden street-smart compliance)
 * 2. Live Gemini Evaluation:
 *    - GEMINI_API_KEY=<key> npm run eval:street-smart-live -- --runs=10
 *    - Runs N multi-turn interactions against live Gemini API
 *    - Evaluates every run with lintConversation
 *    - Outputs failure lines if any run fails
 */

import dotenv from 'dotenv';
dotenv.config();
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://claritiy:testpassword@localhost:5432/claritiy_test';
}

import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildFinalSystemInstruction } from '../src/utils/systemInstructionBuilder';
import { lintConversation, TranscriptTurn } from '../src/utils/conversationQualityLint';

function getArgValue(flag: string, defaultValue: string): string {
  const arg = process.argv.find(a => a.startsWith(`${flag}=`));
  if (arg) {
    return arg.split('=')[1];
  }
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return defaultValue;
}

async function runLiveMultiTurn(apiKey: string, runIndex: number): Promise<TranscriptTurn[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const hrAgent = {
    name: 'Executive Talent Recruiter',
    industry: 'recruitment',
    systemPrompt: `You are Priya, a senior talent acquisition specialist at Claritiy. You are conducting an initial phone screening with a senior software candidate. Confirm their experience, note salary expectation, and propose an interview slot for the engineering team. Keep responses conversational, concise, and adhere strictly to all conversation guidelines.`,
  };

  const systemInstruction = buildFinalSystemInstruction(hrAgent, { direction: 'outbound' });

  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 250,
    },
  });

  const chat = model.startChat();
  const transcript: TranscriptTurn[] = [];

  const callerTurns = [
    'Hello, who is this calling?',
    'I have five years of backend engineering experience. My expected salary is five lakh per month.',
    'When can we do the next round? You tell me.',
    'Tomorrow at 10 AM works.',
    'Just to confirm, why will your team reach out to me next?',
    'Theek hai, thank you. Bye!',
  ];

  for (const userUtterance of callerTurns) {
    transcript.push({ role: 'user', text: userUtterance });
    const response = await chat.sendMessage(userUtterance);
    const agentReply = response.response.text().trim();
    transcript.push({ role: 'agent', text: agentReply });
  }

  return transcript;
}

async function main() {
  const runsArg = parseInt(getArgValue('--runs', '10'), 10);
  const totalRuns = isNaN(runsArg) || runsArg <= 0 ? 10 : runsArg;
  const mockMode = process.env.EVAL_MOCK;
  const apiKey = process.env.GEMINI_API_KEY;

  console.log('\n===============================================================');
  console.log('CLARITIY VOICE — STREET SMART LIVE / MOCK EVALUATION');
  console.log(`Runs Target: ${totalRuns} | Mode: ${mockMode ? `MOCK (${mockMode})` : apiKey ? 'LIVE (Gemini API)' : 'MOCK (Default Golden)'}`);
  console.log('===============================================================\n');

  // 1. CI Mock Mode: EVAL_MOCK=bad must FAIL
  if (mockMode === 'bad') {
    console.log('[CI CONTRACT EVAL]: Evaluating known BAD transcript fixture (EVAL_MOCK=bad)...');
    const failedPath = path.resolve(__dirname, 'fixtures/hr_recruiter_failed.json');
    const badTurns = JSON.parse(fs.readFileSync(failedPath, 'utf8'));
    const evalResult = lintConversation(badTurns);

    if (!evalResult.passed) {
      console.log(`\x1b[32m✔ PASS\x1b[0m: Bad fixture correctly FAILED conversation quality lint.`);
      console.log(`  Identified ${evalResult.findings.length} quality defects as expected:`);
      evalResult.findings.forEach((f, i) => console.log(`   ${i + 1}. [${f.rule}] ${f.message}`));
      process.exit(0);
    } else {
      console.error(`\x1b[31m✖ FAIL\x1b[0m: Bad fixture erroneously PASSED conversation quality lint!`);
      process.exit(1);
    }
  }

  // 2. CI Mock Mode: EVAL_MOCK=good must PASS
  if (mockMode === 'good') {
    console.log('[CI CONTRACT EVAL]: Evaluating GOLDEN transcript fixture (EVAL_MOCK=good)...');
    const goldenPath = path.resolve(__dirname, 'fixtures/hr_recruiter_golden.json');
    const goodTurns = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
    const evalResult = lintConversation(goodTurns);

    if (evalResult.passed) {
      console.log(`\x1b[32m✔ PASS\x1b[0m: Golden fixture passed 100% cleanly (Score: ${evalResult.score}/100, 0 findings).`);
      process.exit(0);
    } else {
      console.error(`\x1b[31m✖ FAIL\x1b[0m: Golden fixture failed quality lint!`);
      evalResult.findings.forEach(f => console.error(`   - [${f.rule}] ${f.message}`));
      process.exit(1);
    }
  }

  // 3. Live or Golden Iteration Runner
  let passedRuns = 0;
  let failedRuns = 0;
  const failureReports: string[] = [];

  for (let r = 1; r <= totalRuns; r++) {
    process.stdout.write(`Executing Run ${r}/${totalRuns}... `);
    let turns: TranscriptTurn[] = [];

    if (apiKey) {
      try {
        turns = await runLiveMultiTurn(apiKey, r);
      } catch (liveErr: any) {
        console.log(`\x1b[31mERROR\x1b[0m`);
        failedRuns++;
        failureReports.push(`Run ${r} Gemini API execution failed: ${liveErr?.message || String(liveErr)}`);
        continue;
      }
    } else {
      // Default offline deterministic mock run
      const goldenPath = path.resolve(__dirname, 'fixtures/hr_recruiter_golden.json');
      turns = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
    }

    const lintRes = lintConversation(turns);
    if (lintRes.passed) {
      console.log(`\x1b[32mPASS\x1b[0m (Score: ${lintRes.score}/100)`);
      passedRuns++;
    } else {
      console.log(`\x1b[31mFAIL\x1b[0m (Score: ${lintRes.score}/100)`);
      failedRuns++;
      const failureLines = lintRes.findings.map(f => `  [${f.rule}] ${f.message}${f.snippet ? ` -> "${f.snippet}"` : ''}`).join('\n');
      failureReports.push(`--- Run ${r} Failure Lines ---\n${failureLines}`);
    }
  }

  console.log('\n===============================================================');
  console.log(`EVALUATION COMPLETE: ${passedRuns}/${totalRuns} RUNS PASSED (${((passedRuns / totalRuns) * 100).toFixed(1)}%)`);
  console.log('===============================================================\n');

  if (failureReports.length > 0) {
    console.error('FAILING LINES DETECTED (Do not edit prompts blindly):');
    failureReports.forEach(report => console.error(report));
    process.exit(1);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error in eval_street_smart_live runner:', err);
  process.exit(1);
});
