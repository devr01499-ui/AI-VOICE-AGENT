#!/usr/bin/env node
/**
 * Claritiy Voice — Turn Timing Log Analyzer
 * 
 * Analyzes log streams/files containing [PER_TURN_TIMING] markers.
 * Computes p50, p95, max for:
 *   - reply_latency_ms (User speech end -> first audio frame dispatched to carrier)
 *   - ttft_ms (User speech end -> model first token received)
 * 
 * Usage:
 *   node server/scripts/audio/analyze_per_turn_timing.js <path-to-logfile>
 *   cat server.log | node server/scripts/audio/analyze_per_turn_timing.js
 */

const fs = require('fs');
const readline = require('readline');

function calculatePercentile(values, p) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function formatStats(arr) {
  if (arr.length === 0) return 'N/A';
  return `p50=${calculatePercentile(arr, 50)}ms, p95=${calculatePercentile(arr, 95)}ms, max=${calculatePercentile(arr, 100)}ms (n=${arr.length})`;
}

async function run() {
  const filePath = process.argv[2];
  let inputStream;

  if (filePath) {
    if (!fs.existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }
    inputStream = fs.createReadStream(filePath);
  } else if (!process.stdin.isTTY) {
    inputStream = process.stdin;
  } else {
    console.error('Usage: node analyze_per_turn_timing.js <path-to-logfile> OR pipe log via stdin');
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: inputStream,
    crlfDelay: Infinity,
  });

  const perCallData = new Map();
  const overallReply = [];
  const overallTtft = [];
  let parsedTurnLines = 0;

  for await (const line of rl) {
    if (!line.includes('[PER_TURN_TIMING]') && !line.includes('reply_latency_ms')) {
      continue;
    }

    try {
      // Find JSON block within log line
      const jsonStart = line.indexOf('{');
      const jsonEnd = line.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) continue;

      const payload = JSON.parse(line.slice(jsonStart, jsonEnd + 1));
      const callId = payload.callId || 'unknown_call';
      const replyMs = typeof payload.reply_latency_ms === 'number' ? payload.reply_latency_ms : null;
      const ttftMs = typeof payload.ttft_ms === 'number' ? payload.ttft_ms : null;

      if (replyMs === null && ttftMs === null) continue;

      parsedTurnLines++;
      if (!perCallData.has(callId)) {
        perCallData.set(callId, { reply: [], ttft: [] });
      }

      const callEntry = perCallData.get(callId);
      if (replyMs !== null && replyMs >= 0) {
        callEntry.reply.push(replyMs);
        overallReply.push(replyMs);
      }
      if (ttftMs !== null && ttftMs >= 0) {
        callEntry.ttft.push(ttftMs);
        overallTtft.push(ttftMs);
      }
    } catch {
      // Ignore unparseable lines
    }
  }

  console.log('================================================================');
  console.log('CLARITIY VOICE — PER-TURN TIMING TELEMETRY ANALYSIS');
  console.log('================================================================');
  console.log(`Parsed ${parsedTurnLines} valid turn measurement events across ${perCallData.size} calls.\n`);

  if (perCallData.size > 0) {
    console.log('--- PER-CALL BREAKDOWN ---');
    for (const [callId, stats] of perCallData.entries()) {
      console.log(`Call: ${callId}`);
      console.log(`  Reply Latency (Voice-to-Voice): ${formatStats(stats.reply)}`);
      console.log(`  Time To First Token (TTFT):     ${formatStats(stats.ttft)}`);
    }
    console.log('');
  }

  console.log('--- OVERALL FLEET PERCENTILES ---');
  console.log(`Voice-to-Voice Reply Latency (reply_latency_ms):`);
  console.log(`  p50: ${calculatePercentile(overallReply, 50)} ms`);
  console.log(`  p95: ${calculatePercentile(overallReply, 95)} ms`);
  console.log(`  max: ${calculatePercentile(overallReply, 100)} ms`);
  console.log(`  Sample Count: ${overallReply.length}`);
  console.log(`Time-To-First-Token (ttft_ms):`);
  console.log(`  p50: ${calculatePercentile(overallTtft, 50)} ms`);
  console.log(`  p95: ${calculatePercentile(overallTtft, 95)} ms`);
  console.log(`  max: ${calculatePercentile(overallTtft, 100)} ms`);
  console.log(`  Sample Count: ${overallTtft.length}`);
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('Fatal analysis failure:', err);
  process.exit(1);
});
