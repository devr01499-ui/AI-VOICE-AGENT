require('dotenv').config();
const assert = require('assert');
const { derivePanCategory } = require('../dist/services/KycVerificationService');

console.log('=== RUNNING PAN CATEGORY DERIVATION UNIT TESTS ===\n');

// Test 1: Individual PANs (4th char 'P')
const individualPans = ['ABCPE1234F', 'kugpe5678x', 'zzzp9999a', 'AAAP0001B'];
for (const pan of individualPans) {
  const category = derivePanCategory(pan);
  assert.strictEqual(category, 'personal', `Expected ${pan} to derive 'personal', got ${category}`);
  console.log(`✓ ${pan} correctly derived as 'personal' (Individual)`);
}

// Test 2: HUF PANs (4th char 'H')
const hufPans = ['ABCHE1234F', 'AAAH0001B'];
for (const pan of hufPans) {
  const category = derivePanCategory(pan);
  assert.strictEqual(category, 'personal', `Expected ${pan} to derive 'personal', got ${category}`);
  console.log(`✓ ${pan} correctly derived as 'personal' (HUF)`);
}

// Test 3: Company PANs (4th char 'C')
const companyPans = ['ABCCO1234F', 'KUGCE5678X', 'AAAC0001B'];
for (const pan of companyPans) {
  const category = derivePanCategory(pan);
  assert.strictEqual(category, 'company', `Expected ${pan} to derive 'company', got ${category}`);
  console.log(`✓ ${pan} correctly derived as 'company' (Company)`);
}

// Test 4: Firm / LLP PANs (4th char 'F')
const firmPans = ['ABCFO1234F', 'AAAF0001B'];
for (const pan of firmPans) {
  const category = derivePanCategory(pan);
  assert.strictEqual(category, 'company', `Expected ${pan} to derive 'company', got ${category}`);
  console.log(`✓ ${pan} correctly derived as 'company' (Firm / LLP)`);
}

// Test 5: Trust PANs (4th char 'T')
const trustPans = ['ABCTO1234F', 'AAAT0001B'];
for (const pan of trustPans) {
  const category = derivePanCategory(pan);
  assert.strictEqual(category, 'company', `Expected ${pan} to derive 'company', got ${category}`);
  console.log(`✓ ${pan} correctly derived as 'company' (Trust)`);
}

// Test 6: Association of Persons (4th char 'A')
const aopPans = ['ABCAO1234F', 'AAAA0001B'];
for (const pan of aopPans) {
  const category = derivePanCategory(pan);
  assert.strictEqual(category, 'company', `Expected ${pan} to derive 'company', got ${category}`);
  console.log(`✓ ${pan} correctly derived as 'company' (AOP)`);
}

// Test 7: Masked PANs preserving 4th char
const maskedPans = ['ABCP****2D', 'ABCC****5K'];
assert.strictEqual(derivePanCategory(maskedPans[0]), 'personal', 'Masked ABCP****2D should derive personal');
assert.strictEqual(derivePanCategory(maskedPans[1]), 'company', 'Masked ABCC****5K should derive company');
console.log(`✓ Masked PANs with 4th character preserved derive correctly`);

// Test 8: Empty / malformed inputs fail closed to 'personal'
assert.strictEqual(derivePanCategory(''), 'personal');
assert.strictEqual(derivePanCategory(null), 'personal');
assert.strictEqual(derivePanCategory(undefined), 'personal');
assert.strictEqual(derivePanCategory('ABC'), 'personal');
console.log(`✓ Malformed / short inputs fail closed to 'personal' (forces Aadhaar)`);

console.log('\n=== ALL 8 PAN CATEGORY DERIVATION TESTS PASSED! ===');
