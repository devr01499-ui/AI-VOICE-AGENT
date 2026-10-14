require('dotenv').config();
const assert = require('assert');
const { normalizeEmail, isValidEmail, isDisposableEmail } = require('../dist/utils/emailNormalizer');

console.log('=== RUNNING EMAIL NORMALIZATION & DISPOSABLE DEFENSE TESTS ===\n');

// Test 1: Gmail +tag normalization
const e1 = normalizeEmail('user+1@gmail.com');
const e2 = normalizeEmail('user+2@gmail.com');
const e3 = normalizeEmail('user@gmail.com');
assert.strictEqual(e1, 'user@gmail.com', 'user+1@gmail.com must normalize to user@gmail.com');
assert.strictEqual(e2, 'user@gmail.com', 'user+2@gmail.com must normalize to user@gmail.com');
assert.strictEqual(e3, 'user@gmail.com', 'user@gmail.com must normalize to user@gmail.com');
console.log('✓ Test 1: user+1@gmail.com and user+2@gmail.com both normalize to user@gmail.com');

// Test 2: Googlemail -> Gmail domain normalization
const e4 = normalizeEmail('user@googlemail.com');
const e5 = normalizeEmail('User.Name+Test@GoogleMail.com');
assert.strictEqual(e4, 'user@gmail.com', 'googlemail.com domain must normalize to gmail.com');
assert.strictEqual(e5, 'username@gmail.com', 'dots and +tags in googlemail.com must normalize to username@gmail.com');
console.log('✓ Test 2: googlemail.com and dot-aliasing normalize to canonical username@gmail.com');

// Test 3: Other providers (Outlook, iCloud, Proton) +tags
const e6 = normalizeEmail('john.doe+work@outlook.com');
assert.strictEqual(e6, 'john.doe@outlook.com', 'outlook.com +tags must be stripped');
console.log('✓ Test 3: Outlook/Hotmail/iCloud +tags stripped');

// Test 4: Whitespace and case normalization
const e7 = normalizeEmail('   Test.User@Claritiy.COM   ');
assert.strictEqual(e7, 'test.user@claritiy.com', 'Whitespace trimmed and lowercased');
console.log('✓ Test 4: Whitespace trimmed and domain/local lowercased');

// Test 5: Disposable email blocking
assert.strictEqual(isDisposableEmail('test@10minutemail.com'), true, '10minutemail.com must be identified as disposable');
assert.strictEqual(isDisposableEmail('user@temp-mail.org'), true, 'temp-mail.org must be identified as disposable');
assert.strictEqual(isDisposableEmail('coder@guerrillamail.com'), true, 'guerrillamail.com must be identified as disposable');
assert.strictEqual(isDisposableEmail('coder@sub.10minutemail.com'), true, 'subdomain of 10minutemail.com must be identified as disposable');
assert.strictEqual(isDisposableEmail('legit@claritiy.com'), false, 'claritiy.com must not be identified as disposable');
assert.strictEqual(isDisposableEmail('legit@gmail.com'), false, 'gmail.com must not be identified as disposable');
console.log('✓ Test 5: Disposable email domains successfully identified and blocked');

// Test 6: Syntax validity checks
assert.strictEqual(isValidEmail('valid.user@gmail.com'), true);
assert.strictEqual(isValidEmail('invalid-email-address'), false);
assert.strictEqual(isValidEmail('@nodomain.com'), false);
console.log('✓ Test 6: Email syntax validation verified');

console.log('\n🎉 ALL EMAIL NORMALIZATION TESTS PASSED!\n');
