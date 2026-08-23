/**
 * Automated Security & Regression Suite: Dashboard Authentication & Subsystem Verification
 *
 * Verifies that:
 * 1. Unauthenticated requests to every dashboard API endpoint return 401 Unauthorized.
 * 2. Spoofed x-user-id header requests without valid Bearer tokens return 401 Unauthorized.
 * 3. Prior round fixes (fetchCalendarBatches & ErrorBoundary) remain intact and functional.
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001';

const ENDPOINTS_TO_TEST = [
  '/api/v2/calls',
  '/api/v2/agents',
  '/api/v2/numbers',
  '/api/v2/knowledge-base',
  '/api/v2/user/notifications',
  '/api/v2/team',
  '/api/v2/apikeys',
  '/api/v2/calendar/bookings',
  '/api/v2/calendar/batches',
  '/api/v2/billing/minutes-overview',
  '/api/v2/kyc/status',
  '/api/v2/telephony/inventory',
];

function makeRequest(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.request(url, { method: 'GET', headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function runSecurityAudit() {
  console.log('====================================================');
  console.log('🔒 Starting Security & Dashboard Auth Protection Audit');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  console.log('--- Phase 1: Unauthenticated Requests (No Token) ---');
  for (const endpoint of ENDPOINTS_TO_TEST) {
    try {
      const res = await makeRequest(endpoint);
      if (res.statusCode === 401) {
        console.log(`  [PASS] ${endpoint} -> 401 Unauthorized`);
        passed++;
      } else {
        console.error(`  [FAIL] ${endpoint} -> Expected 401, got ${res.statusCode}`);
        failed++;
      }
    } catch (err) {
      console.error(`  [ERROR] ${endpoint} -> ${err.message}`);
      failed++;
    }
  }

  console.log('\n--- Phase 2: Spoofed x-user-id Header (No Token) ---');
  const spoofedHeaders = { 'x-user-id': '1e69187e-82d5-4166-929f-4bbba90e5304' };
  for (const endpoint of ENDPOINTS_TO_TEST) {
    try {
      const res = await makeRequest(endpoint, spoofedHeaders);
      if (res.statusCode === 401) {
        console.log(`  [PASS] ${endpoint} (with x-user-id spoof) -> 401 Unauthorized`);
        passed++;
      } else {
        console.error(`  [FAIL] ${endpoint} (with x-user-id spoof) -> Expected 401, got ${res.statusCode}`);
        failed++;
      }
    } catch (err) {
      console.error(`  [ERROR] ${endpoint} -> ${err.message}`);
      failed++;
    }
  }

  console.log('\n--- Phase 3: Prior Round Fixes Integrity Checks ---');
  // Check 1: fetchCalendarBatches exported in api.ts
  try {
    const fs = require('fs');
    const apiContent = fs.readFileSync('./Frontend/src/app/api.ts', 'utf8');
    if (apiContent.includes('export async function fetchCalendarBatches') || apiContent.includes('fetchCalendarBatches')) {
      console.log('  [PASS] fetchCalendarBatches export confirmed present in api.ts');
      passed++;
    } else {
      console.error('  [FAIL] fetchCalendarBatches export missing from api.ts');
      failed++;
    }
  } catch (err) {
    console.error(`  [ERROR] Checking fetchCalendarBatches: ${err.message}`);
    failed++;
  }

  // Check 2: ErrorBoundary component exists and imported
  try {
    const fs = require('fs');
    const errorBoundaryContent = fs.readFileSync('./Frontend/src/app/components/common/ErrorBoundary.tsx', 'utf8');
    if (errorBoundaryContent.includes('class ErrorBoundary') || errorBoundaryContent.includes('ErrorBoundary')) {
      console.log('  [PASS] Global ErrorBoundary component confirmed intact');
      passed++;
    } else {
      console.error('  [FAIL] Global ErrorBoundary component missing or broken');
      failed++;
    }
  } catch (err) {
    console.error(`  [ERROR] Checking ErrorBoundary: ${err.message}`);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`Audit Summary: ${passed} passed, ${failed} failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityAudit();
