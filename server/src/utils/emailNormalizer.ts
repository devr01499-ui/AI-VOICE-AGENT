/**
 * Email Normalization & Disposable Email Defense Utility
 *
 * Implements strict security measures to prevent duplicate accounts,
 * +tag manipulation, dot-aliasing bypasses, and disposable email registrations.
 */

// Comprehensive disposable email provider blacklist
export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  '10minutemail.com',
  '10minutemail.net',
  'tempmail.com',
  'temp-mail.org',
  'tempmail.net',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.biz',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'sharklasers.com',
  'grr.la',
  'pokemail.net',
  'spam4.me',
  'mailinator.com',
  'mailinator2.com',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'trashmail.com',
  'trashmail.net',
  'trashmail.me',
  'throwawaymail.com',
  'dispostable.com',
  'fakeinbox.com',
  'getairmail.com',
  'mohmal.com',
  'burnermail.io',
  'mytemp.email',
  'crazymailing.com',
  'generator.email',
  'armyspy.com',
  'cuvox.de',
  'dayrep.com',
  'fleckens.hu',
  'gustr.com',
  'jourrapide.com',
  'rhyta.com',
  'superrito.com',
  'teleworm.us',
  'einrot.com',
  'inboxkitten.com',
  'minutemailbox.com',
  'tempail.com',
  'emailondeck.com',
  'nada.ltd',
  'getnada.com',
  'dropmail.me',
  'inboxbear.com',
  'maildrop.cc',
]);

// Email domains that officially ignore/strip everything after '+'
const PLUS_TAG_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'google.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'ymail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'protonmail.com',
  'proton.me',
  'fastmail.com',
]);

/**
 * Validates standard email address syntax defensively.
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;

  // RFC 5322 compliant regex for practical production validation
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed);
}

/**
 * Normalizes email address to its canonical identity to eliminate duplicate account bypasses.
 * 
 * Rules:
 * 1. Trim whitespace.
 * 2. Convert to lowercase.
 * 3. Treat googlemail.com as gmail.com.
 * 4. For Gmail/Googlemail: strip dots and strip '+tag'.
 * 5. For other major providers (Outlook, Yahoo, iCloud, Proton): strip '+tag'.
 * 6. Return canonical email string: canonicalLocal@canonicalDomain.
 */
export function normalizeEmail(rawEmail: string): string {
  if (!rawEmail || typeof rawEmail !== 'string') {
    throw new Error('INVALID_EMAIL: Email must be a non-empty string.');
  }

  const trimmed = rawEmail.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf('@');

  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    throw new Error(`INVALID_EMAIL_FORMAT: '${rawEmail}' is not a valid email address.`);
  }

  let localPart = trimmed.substring(0, atIndex);
  let domain = trimmed.substring(atIndex + 1);

  // Treat googlemail.com as gmail.com
  if (domain === 'googlemail.com') {
    domain = 'gmail.com';
  }

  // Strip '+' tags for supported domains
  if (PLUS_TAG_DOMAINS.has(domain)) {
    const plusIndex = localPart.indexOf('+');
    if (plusIndex !== -1) {
      localPart = localPart.substring(0, plusIndex);
    }
  }

  // Gmail ignores all periods in the username
  if (domain === 'gmail.com') {
    localPart = localPart.replace(/\./g, '');
  }

  if (!localPart) {
    throw new Error(`INVALID_EMAIL_LOCALPART: Email local part cannot be empty after normalization for '${rawEmail}'.`);
  }

  return `${localPart}@${domain}`;
}

/**
 * Checks whether an email domain belongs to known disposable/temporary email services.
 */
export function isDisposableEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) return false;

  const domain = parts[1];
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return true;
  }

  // Also check if domain is a subdomain of a disposable domain
  for (const disposable of DISPOSABLE_EMAIL_DOMAINS) {
    if (domain.endsWith(`.${disposable}`)) {
      return true;
    }
  }

  return false;
}
