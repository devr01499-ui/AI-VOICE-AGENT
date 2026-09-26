/**
 * Phase 1 RBAC Verification Suite
 * 
 * Verifies:
 * 1. Imports and executes the REAL requireRole middleware function from server build.
 * 2. Role enforcement across all role tiers (admin, developer, analyst, viewer).
 * 3. Permanent Owner / Admin Immunity in real requireRole middleware.
 */

require('dotenv').config({ path: './server/.env' });
const { requireRole } = require('../server/dist/middleware/auth');

function createMockReqRes(workspaceRole, effectiveWorkspaceId, userId, accountType) {
  const req = {
    workspaceRole,
    effectiveWorkspaceId,
    userId,
    user: { accountType },
  };

  let statusCode = 200;
  let jsonResponse = null;
  let nextCalled = false;

  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(body) {
      jsonResponse = body;
      return res;
    }
  };

  const next = () => {
    nextCalled = true;
  };

  return {
    req,
    res,
    next,
    getResult: () => ({ statusCode, jsonResponse, nextCalled }),
  };
}

async function testRbacLogic() {
  console.log('====================================================');
  console.log('🛡️  Starting Phase 1 Real Production RBAC Middleware Verification');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assertMiddlewareAccess(allowedRoles, role, effectiveWorkspaceId, userId, accountType, expectedAllowed, testName) {
    const middleware = requireRole(allowedRoles);
    const { req, res, next, getResult } = createMockReqRes(role, effectiveWorkspaceId, userId, accountType);
    
    middleware(req, res, next);
    const { statusCode, nextCalled } = getResult();
    const actualAllowed = nextCalled && statusCode === 200;

    if (actualAllowed === expectedAllowed) {
      console.log(`  [PASS] ${testName} (Role: ${role}, Owner: ${effectiveWorkspaceId === userId}) -> Allowed: ${actualAllowed}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} -> Expected Allowed: ${expectedAllowed}, Got: ${actualAllowed} (Status: ${statusCode})`);
      failed++;
    }
  }

  console.log('--- Test 1: Workspace Owner Permanent Admin Immunity in Real Middleware ---');
  assertMiddlewareAccess(['admin'], 'viewer', 'user-123', 'user-123', 'free', true, 'Owner with viewer TeamMember record');
  assertMiddlewareAccess(['admin'], 'analyst', 'user-123', 'user-123', 'free', true, 'Owner with analyst TeamMember record');
  assertMiddlewareAccess(['admin'], 'developer', 'user-123', 'user-123', 'free', true, 'Owner with developer TeamMember record');

  console.log('\n--- Test 2: Real Admin Tier Permissions ---');
  assertMiddlewareAccess(['admin'], 'admin', 'owner-999', 'user-111', 'free', true, 'Admin access to billing');
  assertMiddlewareAccess(['admin', 'developer'], 'admin', 'owner-999', 'user-111', 'free', true, 'Admin access to agent creation');

  console.log('\n--- Test 3: Real Developer Tier Permissions ---');
  assertMiddlewareAccess(['admin', 'developer'], 'developer', 'owner-999', 'user-222', 'free', true, 'Developer access to agent creation');
  assertMiddlewareAccess(['admin'], 'developer', 'owner-999', 'user-222', 'free', false, 'Developer BLOCKED from billing');

  console.log('\n--- Test 4: Real Analyst Tier Permissions ---');
  assertMiddlewareAccess(['admin', 'developer', 'analyst', 'viewer'], 'analyst', 'owner-999', 'user-333', 'free', true, 'Analyst access to call history & analytics');
  assertMiddlewareAccess(['admin', 'developer'], 'analyst', 'owner-999', 'user-333', 'free', false, 'Analyst BLOCKED from creating agents');

  console.log('\n--- Test 5: Real Viewer Tier Permissions ---');
  assertMiddlewareAccess(['admin', 'developer', 'analyst', 'viewer'], 'viewer', 'owner-999', 'user-444', 'free', true, 'Viewer access to read-only views');
  assertMiddlewareAccess(['admin', 'developer'], 'viewer', 'owner-999', 'user-444', 'free', false, 'Viewer BLOCKED from editing agents');
  assertMiddlewareAccess(['admin'], 'viewer', 'owner-999', 'user-444', 'free', false, 'Viewer BLOCKED from purchasing numbers');

  console.log('\n====================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

testRbacLogic();
