/**
 * Toll-fraud protection for outbound calls (CLAUDE.md §7 "DoS/abuse on voice").
 *
 * The platform pays the carrier for every outbound minute. A stolen or abusive account could
 * otherwise dial expensive international or premium-rate numbers. Policy:
 *  - Indian numbers are allowed: +91 / 91 / 0 / bare 10-digit national forms.
 *  - Indian premium-rate (1900) and shared-cost (1860) service numbers are blocked.
 *  - Other countries are blocked unless their calling code is listed in the environment variable
 *    OUTBOUND_ALLOWED_COUNTRY_CODES (comma-separated, e.g. "91,971"); "91" is always allowed.
 */
export type DestinationCheck = { allowed: true; country: string } | { allowed: false; reason: string };

const BLOCKED_INDIAN_PREFIXES = ['1900', '1860'];

function allowedCountryCodes(raw: string | undefined): Set<string> {
  const codes = new Set<string>(['91']);
  for (const part of (raw || '').split(',')) {
    const code = part.trim().replace(/^\+/, '');
    if (/^[1-9]\d{0,3}$/.test(code)) codes.add(code);
  }
  return codes;
}

/** Returns the national Indian number (10 digits) when the input is an Indian number, else null. */
function indianNational(digits: string, hadPlus: boolean): string | null {
  if (!hadPlus && digits.length === 10 && /^[1-9]/.test(digits)) return digits;
  if (!hadPlus && digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return null;
}

export function checkOutboundDestination(phoneNumber: string, allowedCodesRaw = process.env.OUTBOUND_ALLOWED_COUNTRY_CODES): DestinationCheck {
  const raw = String(phoneNumber || '').trim();
  const hadPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7) return { allowed: false, reason: 'The destination number is too short.' };

  const national = indianNational(digits, hadPlus);
  if (national) {
    if (BLOCKED_INDIAN_PREFIXES.some((p) => national.startsWith(p))) {
      return { allowed: false, reason: 'Premium-rate and shared-cost service numbers (1900, 1860) cannot be called.' };
    }
    return { allowed: true, country: '91' };
  }

  const codes = allowedCountryCodes(allowedCodesRaw);
  for (const code of codes) {
    if (code !== '91' && digits.startsWith(code) && hadPlus) return { allowed: true, country: code };
  }
  return {
    allowed: false,
    reason: 'Calls to this country are not enabled for your account. Only Indian numbers can be called. Contact support to enable another country.',
  };
}
