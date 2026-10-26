/**
 * e2e-call-harness — Cross-Platform Node.js Test Suite Runner
 *
 * Runs:
 * 1. 10 consecutive Outbound call simulations
 * 2. 10 consecutive Inbound call simulations
 * 3. 1 Setup Rejection & Safe-Tier Retry simulation
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = process.env.PORT || '3001';
const FAKE_GEMINI_PORT = process.env.FAKE_GEMINI_PORT || '8095';

function pollEndpoint(url, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve(true);
        } else if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timeout polling ${url}: returned HTTP ${res.statusCode}`));
        } else {
          setTimeout(check, 300);
        }
      }).on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timeout polling ${url}`));
        } else {
          setTimeout(check, 300);
        }
      });
    };
    check();
  });
}

function runSim(mode) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, 'call_sim.js'), mode], {
      stdio: 'inherit',
      env: {
        ...process.env,
        PORT,
        FAKE_GEMINI_PORT,
        GEMINI_WS_BASE: `ws://127.0.0.1:${FAKE_GEMINI_PORT}`,
        GEMINI_HTTP_BASE: `http://127.0.0.1:${FAKE_GEMINI_PORT}`,
        NODE_ENV: 'test',
      },
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`call_sim.js [${mode}] exited with code ${code}`));
    });
  });
}

async function main() {
  console.log('=================================================================');
  console.log('🚀 RUNNING CROSS-PLATFORM E2E CALL HARNESS CI SUITE');
  console.log('=================================================================');

  // 1. Start Fake Gemini Server
  console.log(`1. Launching Fake Gemini on port ${FAKE_GEMINI_PORT}...`);
  const fakeGeminiProcess = spawn(process.execPath, [path.join(__dirname, 'fake_gemini.js')], {
    stdio: 'inherit',
    env: { ...process.env, FAKE_GEMINI_PORT },
  });

  // 2. Start Application Server
  console.log(`2. Launching Voice Engine Server on port ${PORT}...`);
  const serverProcess = spawn(process.execPath, [path.join(ROOT_DIR, 'server', 'dist', 'index.js')], {
    stdio: 'inherit',
    cwd: path.join(ROOT_DIR, 'server'),
    env: {
      ...process.env,
      PORT,
      GEMINI_WS_BASE: `ws://127.0.0.1:${FAKE_GEMINI_PORT}`,
      GEMINI_HTTP_BASE: `http://127.0.0.1:${FAKE_GEMINI_PORT}`,
      NODE_ENV: 'test',
    },
  });

  const cleanup = () => {
    console.log('\n🧹 Cleaning up test service processes...');
    try { fakeGeminiProcess.kill(); } catch {}
    try { serverProcess.kill(); } catch {}
  };

  process.on('SIGINT', () => { cleanup(); process.exit(1); });
  process.on('SIGTERM', () => { cleanup(); process.exit(1); });

  try {
    await pollEndpoint(`http://127.0.0.1:${FAKE_GEMINI_PORT}/health`, 10000);
    console.log('✓ Fake Gemini server online');

    await pollEndpoint(`http://127.0.0.1:${PORT}/health`, 20000);
    console.log('✓ Voice Engine server online');

    // 10 Outbound calls
    console.log('\n=================================================================');
    console.log('📞 PHASE 1: 10 OUTBOUND CALL SIMULATIONS');
    console.log('=================================================================');
    for (let i = 1; i <= 10; i++) {
      console.log(`\n--- Iteration ${i}/10 (Outbound) ---`);
      await runSim('outbound');
    }

    // 10 Inbound calls
    console.log('\n=================================================================');
    console.log('📞 PHASE 2: 10 INBOUND CALL SIMULATIONS');
    console.log('=================================================================');
    for (let i = 1; i <= 10; i++) {
      console.log(`\n--- Iteration ${i}/10 (Inbound) ---`);
      await runSim('inbound');
    }

    // 1 Safe-tier retry
    console.log('\n=================================================================');
    console.log('🛡️ PHASE 3: SAFE-TIER RETRY SIMULATION');
    console.log('=================================================================');
    await runSim('reject_retry');

    console.log('\n=================================================================');
    console.log('🎉 ALL 21 TEST RUNS GREEN! ZERO TIMING RACES DETECTED.');
    console.log('=================================================================');
    cleanup();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ CI HARNESS SUITE ENCOUNTERED AN ERROR:', err.message);
    cleanup();
    process.exit(1);
  }
}

main();
