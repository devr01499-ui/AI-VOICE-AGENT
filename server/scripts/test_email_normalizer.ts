import assert from 'assert';
import { normalizeEmail, isValidEmail, isDisposableEmail } from '../src/utils/emailNormalizer.ts';

console.log('🧪 [TEST] Running Email Normalization & Disposable Email Defense Test...');

// 1. Gmail +tag normalization
const e1 = normalizeEmail('user+1@gmail.com');
const e2 = normalizeEmail('user+2@gmail.com');
const e3 = normalizeEmail('user@gmail.com');
assert.strictEqual(e1, 'user@gmail.com', 'user+1@gmail.com must normalize to user@gmail.com');
assert.strictEqual(e2, 'user@gmail.com', 'user+2@gmail.com must normalize to user@gmail.com');
assert.strictEqual(e3, 'user@gmail.com', 'user@gmail.com must normalize to user@gmail.com');
console.log('✅ Test 1 Passed: Gmail +tags stripped and matched canonical identity');

// 2. Googlemail -> Gmail domain normalization
const e4 = normalizeEmail('user@googlemail.com');
const e5 = normalizeEmail('User.Name+Test@GoogleMail.com');
assert.strictEqual(e4, 'user@gmail.com', 'googlemail.com domain must normalize to gmail.com');
assert.strictEqual(e5, 'username@gmail.com', 'dots and +tags in googlemail.com must normalize to username@gmail.com');
console.log('✅ Test 2 Passed: googlemail.com alias mapped to gmail.com and dots removed');

// 3. Outlook / iCloud +tags
const e6 = normalizeEmail('john.doe+work@outlook.com');
assert.strictEqual(e6, 'john.doe@outlook.com', 'outlook.com +tags must be stripped');
console.log('✅ Test 3 Passed: Outlook/Hotmail/iCloud +tags stripped');

// 4. Whitespace and case normalization
const e7 = normalizeEmail('   Test.User@CorporateDomain.COM   ');
assert.strictEqual(e7, 'test.user@corporatedomain.com', 'Whitespace trimmed and lowercased');
console.log('✅ Test 4 Passed: Whitespace trimmed and domain/local lowercased');

// 5. Disposable email blocking
assert.strictEqual(isDisposableEmail('test@10minutemail.com'), true, '10minutemail.com must be identified as disposable');
assert.strictEqual(isDisposableEmail('user@temp-mail.org'), true, 'temp-mail.org must be identified as disposable');
assert.strictEqual(isDisposableEmail('coder@guerrillamail.com'), true, 'guerrillamail.com must be identified as disposable');
assert.strictEqual(isDisposableEmail('coder@sub.10minutemail.com'), true, 'subdomain of 10minutemail.com must be identified as disposable');
assert.strictEqual(isDisposableEmail('legit@claritiy.com'), false, 'claritiy.com must not be identified as disposable');
assert.strictEqual(isDisposableEmail('legit@gmail.com'), false, 'gmail.com must not be identified as disposable');
console.log('✅ Test 5 Passed: Disposable email domains blocked');

// 6. Validity checks
assert.strictEqual(isValidEmail('valid.user@gmail.com'), true);
assert.strictEqual(isValidEmail('invalid-email-address'), false);
assert.strictEqual(isValidEmail('@nodomain.com'), false);
console.log('✅ Test 6 Passed: Email syntax validation verified');

console.log('🎉 [TEST] All Email Normalization tests passed successfully!');
