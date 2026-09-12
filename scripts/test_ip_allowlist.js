require('dotenv').config({ path: './server/.env' });
const { prisma } = require('../server/dist/lib/prisma');
const { isIpAllowed } = require('../server/dist/utils/ipChecker');

async function runTest() {
  console.log("=== Phase 5 IP Allowlist Verification Suite ===");

  let passed = 0;
  let failed = 0;

  function assert(condition, description) {
    if (condition) {
      console.log(`  [PASS] ${description}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${description}`);
      failed++;
    }
  }

  try {
    console.log("\n1. Testing IP Matcher Logic Unit Tests...");

    // Test 1: Empty list (Allow all)
    assert(isIpAllowed('192.168.1.10', []) === true, "Empty allowlist permits any IP (default behavior)");
    assert(isIpAllowed('10.0.0.1', null) === true, "Null allowlist permits any IP");

    // Test 2: CIDR IPv4 Range Matching
    const cidrList = ['192.168.1.0/24', '10.0.0.0/8'];
    assert(isIpAllowed('192.168.1.5', cidrList) === true, "IP 192.168.1.5 allowed in 192.168.1.0/24");
    assert(isIpAllowed('192.168.1.254', cidrList) === true, "IP 192.168.1.254 allowed in 192.168.1.0/24");
    assert(isIpAllowed('10.255.4.1', cidrList) === true, "IP 10.255.4.1 allowed in 10.0.0.0/8");
    assert(isIpAllowed('192.168.2.1', cidrList) === false, "IP 192.168.2.1 correctly REJECTED by 192.168.1.0/24");
    assert(isIpAllowed('172.16.0.1', cidrList) === false, "IP 172.16.0.1 correctly REJECTED");

    // Test 3: IPv6 Mapped IPv4
    assert(isIpAllowed('::ffff:192.168.1.42', cidrList) === true, "IPv6 mapped IPv4 ::ffff:192.168.1.42 matched against IPv4 CIDR");

    // Test 4: Single IP Exact Match
    const singleIpList = ['203.0.113.50'];
    assert(isIpAllowed('203.0.113.50', singleIpList) === true, "Exact single IP 203.0.113.50 allowed");
    assert(isIpAllowed('203.0.113.51', singleIpList) === false, "Different IP 203.0.113.51 rejected");

    // Test 5: Wildcard Allow All
    assert(isIpAllowed('8.8.8.8', ['0.0.0.0/0']) === true, "Wildcard 0.0.0.0/0 allows any IP");

    console.log("\n2. Testing Database Persistence & User Schema...");
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error("No test user found in database");
    }

    const testRules = ['192.168.1.0/24', '203.0.113.50'];
    await prisma.user.update({
      where: { id: user.id },
      data: { allowedIpRanges: testRules }
    });

    const verifyUser = await prisma.user.findUnique({ where: { id: user.id } });
    assert(
      JSON.stringify(verifyUser.allowedIpRanges) === JSON.stringify(testRules),
      `Database successfully persisted allowedIpRanges: ${JSON.stringify(verifyUser.allowedIpRanges)}`
    );

    // Reset user allowedIpRanges
    await prisma.user.update({
      where: { id: user.id },
      data: { allowedIpRanges: [] }
    });
    console.log("  [INFO] Reset user allowedIpRanges to empty array (Allow all).");

    console.log("\n==========================================");
    console.log(`Summary: ${passed} Passed, ${failed} Failed`);
    console.log("==========================================");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Phase 5 Verification failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
