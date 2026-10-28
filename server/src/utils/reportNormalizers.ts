/**
 * reportNormalizers.ts — Deterministic Normalization and Validation Engine
 *
 * Implements code-based deterministic normalisation (Section 5.6):
 * - Numbers and Money: lakh, crore, Hindi & Devanagari numerals (०-९), and words (ek, do, teen, paanch...) -> integers & INR.
 * - Dates and relative expressions ('kal', 'parson', 'next Monday', etc.) resolved against call start time in Asia/Kolkata.
 * - Durations ('ek mahina', 'two weeks', 'immediate') -> normalized to days.
 * - Identifiers: Phone numbers, emails, Indian postal PIN codes (6 digits).
 * - Enums: Validates against allowed list, non-matches set to null with a flag.
 */

// Devanagari numeral mapping
const DEVANAGARI_DIGITS: Record<string, string> = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
};

// Hindi / Hinglish number words mapping
const HINDI_NUMBER_WORDS: Record<string, number> = {
  'zero': 0, 'shunya': 0,
  'ek': 1, 'one': 1,
  'do': 2, 'two': 2,
  'teen': 3, 'three': 3,
  'char': 4, 'chaar': 4, 'four': 4,
  'paanch': 5, 'panch': 5, 'five': 5,
  'chhe': 6, 'chhah': 6, 'six': 6,
  'saat': 7, 'seven': 7,
  'aath': 8, 'eight': 8,
  'nau': 9, 'nine': 9,
  'das': 10, 'ten': 10,
  'gyarah': 11, 'eleven': 11,
  'barah': 12, 'twelve': 12,
  'terah': 13, 'thirteen': 13,
  'chaudah': 14, 'fourteen': 14,
  'pandrah': 15, 'fifteen': 15,
  'solah': 16, 'sixteen': 16,
  'satrah': 17, 'seventeen': 17,
  'atharah': 18, 'eighteen': 18,
  'unnis': 19, 'nineteen': 19,
  'bees': 20, 'twenty': 20,
  'tees': 30, 'thirty': 30,
  'chaalis': 40, 'chalis': 40, 'forty': 40,
  'pachaas': 50, 'pachas': 50, 'fifty': 50,
  'saath': 60, 'sath': 60, 'sixty': 60,
  'sattar': 70, 'seventy': 70,
  'assi': 80, 'eighty': 80,
  'nabbe': 90, 'navve': 90, 'ninety': 90,
  'sau': 100, 'hundred': 100,
  'hazaar': 1000, 'hazar': 1000, 'thousand': 1000,
  'lakh': 100000, 'lac': 100000,
  'crore': 10000000, 'cr': 10000000,
};

/**
 * Normalizes Devanagari numerals (०-९) to ASCII digits (0-9).
 */
export function normalizeDevanagariDigits(text: string): string {
  if (!text) return text;
  return text.replace(/[०-९]/g, (ch) => DEVANAGARI_DIGITS[ch] || ch);
}

/**
 * Normalizes numbers and currency expressions (including lakh, crore, Hinglish words).
 * Returns integer amount in INR or number, or null if unparseable.
 */
export function normalizeMoneyOrNumber(raw: string | number | null | undefined): { value: number | null; raw: string; error?: string } {
  if (raw === null || raw === undefined) return { value: null, raw: '' };
  if (typeof raw === 'number') return { value: Math.round(raw), raw: String(raw) };

  let text = String(raw).trim().toLowerCase();
  text = normalizeDevanagariDigits(text);

  // Remove currency symbols and commas
  text = text.replace(/[₹$,]/g, '').trim();

  // Pattern: "<number> lakh" or "<number> crore"
  const multiplierMatch = text.match(/^([\d.]+)\s*(lakh|lac|crore|cr|k|thousand|hazar)\b/i);
  if (multiplierMatch) {
    const base = parseFloat(multiplierMatch[1]);
    const unit = multiplierMatch[2].toLowerCase();
    let multiplier = 1;
    if (unit === 'lakh' || unit === 'lac') multiplier = 100000;
    else if (unit === 'crore' || unit === 'cr') multiplier = 10000000;
    else if (unit === 'k' || unit === 'thousand' || unit === 'hazar') multiplier = 1000;

    if (!isNaN(base)) {
      return { value: Math.round(base * multiplier), raw: String(raw) };
    }
  }

  // Word-based numbers (e.g. "paanch lakh", "do crore", "pachaas hazaar")
  const words = text.split(/\s+/);
  let total = 0;
  let currentGroup = 0;
  let matchedWord = false;

  for (const word of words) {
    const val = HINDI_NUMBER_WORDS[word];
    if (val !== undefined) {
      matchedWord = true;
      if (val === 100000 || val === 10000000 || val === 1000) {
        currentGroup = (currentGroup === 0 ? 1 : currentGroup) * val;
        total += currentGroup;
        currentGroup = 0;
      } else if (val === 100) {
        currentGroup = (currentGroup === 0 ? 1 : currentGroup) * val;
      } else {
        currentGroup += val;
      }
    }
  }
  total += currentGroup;

  if (matchedWord && total > 0) {
    return { value: total, raw: String(raw) };
  }

  // Fallback plain float / integer parse
  const cleanNumeric = text.replace(/[^\d.]/g, '');
  if (cleanNumeric) {
    const parsed = parseFloat(cleanNumeric);
    if (!isNaN(parsed)) {
      return { value: Math.round(parsed), raw: String(raw) };
    }
  }

  return { value: null, raw: String(raw), error: 'INVALID_NUMBER_FORMAT' };
}

/**
 * Normalizes relative date expressions against reference call start time in Asia/Kolkata timezone.
 * Rejects promised dates in the past.
 */
export function normalizeDate(
  rawText: string | null | undefined,
  referenceDate: Date = new Date()
): { date: string | null; error?: string } {
  if (!rawText) return { date: null };

  const text = rawText.trim().toLowerCase();

  // Create Date object in Asia/Kolkata (UTC+5:30)
  const kolkataOffsetMs = 5.5 * 60 * 60 * 1000;
  const refKolkataTime = new Date(referenceDate.getTime() + kolkataOffsetMs);
  const targetDate = new Date(refKolkataTime);

  // Match relative Hindi & English tokens
  if (text.includes('aaj') || text.includes('today')) {
    // Today
  } else if (text.includes('kal') || text.includes('tomorrow')) {
    targetDate.setUTCDate(targetDate.getUTCDate() + 1);
  } else if (text.includes('parson') || text.includes('day after tomorrow')) {
    targetDate.setUTCDate(targetDate.getUTCDate() + 2);
  } else if (text.includes('narson')) {
    targetDate.setUTCDate(targetDate.getUTCDate() + 3);
  } else if (text.includes('next week') || text.includes('agle hafte')) {
    targetDate.setUTCDate(targetDate.getUTCDate() + 7);
  } else if (text.includes('next monday') || text.includes('somwar')) {
    const day = targetDate.getUTCDay();
    const daysUntilMonday = (1 + 7 - day) % 7 || 7;
    targetDate.setUTCDate(targetDate.getUTCDate() + daysUntilMonday);
  } else {
    // Attempt standard ISO / date parse
    const parsed = new Date(rawText);
    if (!isNaN(parsed.getTime())) {
      // Validate promised date is not in the past relative to referenceDate
      const diffMs = parsed.getTime() - referenceDate.getTime();
      // Allow up to 12 hour grace for same-day timezone slippage
      if (diffMs < -12 * 60 * 60 * 1000) {
        return { date: null, error: 'PROMISED_DATE_IN_PAST' };
      }
      return { date: parsed.toISOString().split('T')[0] };
    }
    return { date: null, error: 'UNRECOGNIZED_DATE_EXPRESSION' };
  }

  const isoDate = targetDate.toISOString().split('T')[0];
  return { date: isoDate };
}

/**
 * Normalizes duration expressions ('ek mahina', 'two weeks', 'immediate') into integer days.
 */
export function normalizeDurationDays(rawText: string | null | undefined): { days: number | null; error?: string } {
  if (!rawText) return { days: null };

  const text = rawText.trim().toLowerCase();

  if (text.includes('immediate') || text.includes('turant') || text.includes('today') || text.includes('same day')) {
    return { days: 0 };
  }

  // Regex patterns
  if (text.includes('mahina') || text.includes('mahine') || text.includes('month')) {
    const num = normalizeMoneyOrNumber(text).value || 1;
    return { days: num * 30 };
  }

  if (text.includes('hafte') || text.includes('hafta') || text.includes('hafton') || text.includes('week')) {
    const num = normalizeMoneyOrNumber(text).value || 1;
    return { days: num * 7 };
  }

  if (text.includes('din') || text.includes('dino') || text.includes('day')) {
    const num = normalizeMoneyOrNumber(text).value || 1;
    return { days: num };
  }

  if (text.includes('saal') || text.includes('year')) {
    const num = normalizeMoneyOrNumber(text).value || 1;
    return { days: num * 365 };
  }

  return { days: null, error: 'UNRECOGNIZED_DURATION_EXPRESSION' };
}

/**
 * Formats and validates Indian 10-digit mobile phone numbers (E.164 +91).
 */
export function validatePhoneNumber(raw: string | null | undefined): { phone: string | null; error?: string } {
  if (!raw) return { phone: null };

  const digits = raw.replace(/\D/g, '');

  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return { phone: `+91${digits}` };
  }
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) {
    return { phone: `+${digits}` };
  }
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits.slice(1))) {
    return { phone: `+91${digits.slice(1)}` };
  }

  return { phone: null, error: 'INVALID_PHONE_NUMBER_FORMAT' };
}

/**
 * Validates email address format.
 */
export function validateEmail(raw: string | null | undefined): { email: string | null; error?: string } {
  if (!raw) return { email: null };

  const clean = raw.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (emailRegex.test(clean)) {
    return { email: clean };
  }

  return { email: null, error: 'INVALID_EMAIL_FORMAT' };
}

/**
 * Validates Indian postal PIN codes (6 digits, cannot start with 0).
 */
export function validatePostalPinCode(raw: string | null | undefined): { pinCode: string | null; error?: string } {
  if (!raw) return { pinCode: null };

  const clean = raw.trim().replace(/\s/g, '');

  if (/^[1-9][0-9]{5}$/.test(clean)) {
    return { pinCode: clean };
  }

  return { pinCode: null, error: 'INVALID_INDIAN_PIN_CODE' };
}

/**
 * Validates categorical value against an allowed list of enum choices.
 * Case-insensitive match, returns canonical enum string or null with flag.
 */
export function validateEnum(
  raw: string | null | undefined,
  allowedChoices: string[]
): { value: string | null; error?: string } {
  if (!raw || allowedChoices.length === 0) return { value: null };

  const clean = raw.trim().toLowerCase();
  const match = allowedChoices.find(c => c.trim().toLowerCase() === clean);

  if (match) {
    return { value: match };
  }

  return { value: null, error: `VALUE_OUTSIDE_ALLOWED_ENUMS [${raw}]` };
}
