/**
 * Phone number validation for forms. The server repeats the same check
 * (server/src/utils/phoneValidator.ts) and is the source of truth; keep both in sync.
 *
 * Accepted: Indian mobile (10 digits starting 6–9, optional +91 / 91 / 0 prefix),
 * or any international number written with "+" and country code (8–15 digits).
 */

export type PhoneValidationResult =
  | { ok: true; e164: string }
  | { ok: false; error: string };

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

export function normalizePhoneNumber(input: unknown): PhoneValidationResult {
  if (typeof input !== "string" || input.trim() === "") {
    return { ok: false, error: "Contact number is required." };
  }

  const trimmed = input.trim();
  if (trimmed.length > 32 || /[^\d+\s\-().]/.test(trimmed)) {
    return { ok: false, error: "Contact number can contain only digits, spaces and a leading +." };
  }

  const compact = trimmed.replace(/[\s\-().]/g, "");
  const hasPlus = compact.startsWith("+");
  if (compact.indexOf("+", 1) !== -1) {
    return { ok: false, error: "Contact number can contain only digits, spaces and a leading +." };
  }
  const digits = trimmed.replace(/\D/g, "");

  if (hasPlus) {
    if (digits.startsWith("91")) {
      const national = digits.slice(2);
      return INDIAN_MOBILE.test(national)
        ? { ok: true, e164: `+91${national}` }
        : { ok: false, error: "Enter a valid Indian mobile number: 10 digits starting with 6, 7, 8 or 9." };
    }
    if (digits.length >= 8 && digits.length <= 15 && digits[0] !== "0") {
      return { ok: true, e164: `+${digits}` };
    }
    return { ok: false, error: "Enter a valid international number with country code, for example +14155550123." };
  }

  let national = digits;
  if (national.length === 11 && national.startsWith("0")) national = national.slice(1);
  else if (national.length === 12 && national.startsWith("91")) national = national.slice(2);

  if (INDIAN_MOBILE.test(national)) {
    return { ok: true, e164: `+91${national}` };
  }
  return {
    ok: false,
    error: "Enter a valid mobile number: 10 digits starting with 6, 7, 8 or 9, or include the country code (for example +14155550123).",
  };
}

/** Simple, strict-enough email shape check for forms; the server normalises and re-validates. */
export function isValidEmailFormat(input: string): boolean {
  const email = input.trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** Password policy for sign-up and password reset. Returns an error message, or null when acceptable. */
export function passwordPolicyError(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 72) return "Password must be at most 72 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Password must contain at least one letter and one number.";
  return null;
}
