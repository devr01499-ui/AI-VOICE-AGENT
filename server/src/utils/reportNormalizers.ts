/**
 * reportNormalizers.ts — Deterministic Normalization and Validation Engine
 *
 * Implements code-based deterministic normalisation (Sections 5.6, C2, C3, C4):
 * - Robust tokenizer for Indian currency and numbers: lakh, crore, thousand, k, lpa, Hinglish words.
 * - Disambiguates English verbs ("I do 5 lakh") from Hindi numerals.
 * - Handles ranges ("18-20 lakh" -> 1800000, "15 to 20 days" -> 15).
 * - Preserves decimals (4.5 -> 4.5, 4.5 lakh -> 450000) without premature rounding.
 * - Durations ("1.5 months" -> 45, "one and a half month" -> 45, "2-3 months" -> 60).
 * - Dates: Asia/Kolkata timezone reference, month words, relative days, and "kal" tense disambiguation.
 */

// Devanagari numeral mapping
const DEVANAGARI_DIGITS: Record<string, string> = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
};

// Hindi & English number words mapping
const NUMBER_WORDS: Record<string, number> = {
  zero: 0, shunya: 0,
  one: 1, ek: 1,
  two: 2, do: 2,
  three: 3, teen: 3,
  four: 4, char: 4, chaar: 4,
  five: 5, paanch: 5, panch: 5,
  six: 6, chhe: 6, chhah: 6,
  seven: 7, saat: 7,
  eight: 8, aath: 8,
  nine: 9, nau: 9,
  ten: 10, das: 10,
  eleven: 11, gyarah: 11,
  twelve: 12, barah: 12,
  thirteen: 13, terah: 13,
  fourteen: 14, chaudah: 14,
  fifteen: 15, pandrah: 15,
  sixteen: 16, solah: 16,
  seventeen: 17, satrah: 17,
  eighteen: 18, atharah: 18,
  nineteen: 19, unnis: 19,
  twenty: 20, bees: 20,
  thirty: 30, tees: 30,
  forty: 40, chaalis: 40, chalis: 40,
  fifty: 50, pachaas: 50, pachas: 50,
  sixty: 60, saath: 60, sath: 60,
  seventy: 70, sattar: 70,
  eighty: 80, assi: 80,
  ninety: 90, nabbe: 90, navve: 90,
  hundred: 100, sau: 100,
  thousand: 1000, hazar: 1000, hazaar: 1000, k: 1000,
  lakh: 100000, lakhs: 100000, lac: 100000, lacs: 100000, lpa: 100000,
  crore: 10000000, crores: 10000000, cr: 10000000,
};

const MONTH_NAMES: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

const DAY_NAMES: Record<string, number> = {
  sunday: 0, raviwar: 0,
  monday: 1, somwar: 1,
  tuesday: 2, mangalwar: 2,
  wednesday: 3, budhwar: 3,
  thursday: 4, guruwar: 4, veervar: 4,
  friday: 5, shukrawar: 5,
  saturday: 6, shaniwar: 6,
};

/**
 * Normalizes Devanagari numerals (०-९) to standard ASCII digits.
 */
export function normalizeDevanagariDigits(text: string): string {
  if (!text) return text;
  return text.replace(/[०-९]/g, (ch) => DEVANAGARI_DIGITS[ch] || ch);
}

/**
 * Normalizes numbers and currency expressions.
 * Handles lakh, crore, thousand, LPA, word numerals, ranges, decimals, and English verb guard.
 */
export function normalizeMoneyOrNumber(raw: string | number | null | undefined): {
  value: number | null;
  raw: string;
  error?: string;
} {
  if (raw === null || raw === undefined) return { value: null, raw: '' };
  if (typeof raw === 'number') {
    return { value: raw, raw: String(raw) };
  }

  let text = String(raw).trim().toLowerCase();
  text = normalizeDevanagariDigits(text);

  // Clean currency symbols and commas (remove commas, replace currency symbols with space)
  text = text.replace(/,/g, '').replace(/[₹$]/g, ' ').replace(/\s+/g, ' ').trim();

  // Negation guard: "no experience", "not stated", "none", "n/a"
  if (/^(no|none|nil|n\/a|not applicable|not stated)$/i.test(text)) {
    return { value: null, raw: String(raw) };
  }

  // 1. Compound Indian denominations with digits:
  // e.g. "5 lakh 50 thousand" -> 500000 + 50000 = 550000
  const compoundMatch = text.match(/(\d+(?:\.\d+)?)\s*(lakh|lakhs|lac|lacs)\s*(\d+(?:\.\d+)?)\s*(thousand|hazar|k)/i);
  if (compoundMatch) {
    const lVal = parseFloat(compoundMatch[1]) * 100000;
    const tVal = parseFloat(compoundMatch[3]) * 1000;
    return { value: lVal + tVal, raw: String(raw) };
  }

  // 2. Range patterns with multiplier:
  // e.g. "18-20 lakh", "18 to 20 lakh", "18-20 lpa" -> take lower bound 18 * 100000 = 1800000
  const rangeMultiplierMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(lakh|lakhs|lac|lacs|crore|crores|cr|thousand|hazar|k|lpa)\b/i);
  if (rangeMultiplierMatch) {
    const lower = parseFloat(rangeMultiplierMatch[1]);
    const unit = rangeMultiplierMatch[3].toLowerCase();
    let mult = 1;
    if (['lakh', 'lakhs', 'lac', 'lacs', 'lpa'].includes(unit)) mult = 100000;
    else if (['crore', 'crores', 'cr'].includes(unit)) mult = 10000000;
    else if (['thousand', 'hazar', 'k'].includes(unit)) mult = 1000;
    return { value: Math.round(lower * mult), raw: String(raw) };
  }

  // 3. Number with multiplier anywhere in string:
  // e.g. "around 5 lakh", "my ctc is 18 lakh per annum", "12 lpa", "5.5 lakh", "I do 5 lakh"
  const multiplierRegex = /(\d+(?:\.\d+)?)\s*(lakh|lakhs|lac|lacs|crore|crores|cr|thousand|hazar|k|lpa)\b/i;
  const matchMult = text.match(multiplierRegex);
  if (matchMult) {
    const base = parseFloat(matchMult[1]);
    const unit = matchMult[2].toLowerCase();
    let mult = 1;
    if (['lakh', 'lakhs', 'lac', 'lacs', 'lpa'].includes(unit)) mult = 100000;
    else if (['crore', 'crores', 'cr'].includes(unit)) mult = 10000000;
    else if (['thousand', 'hazar', 'k'].includes(unit)) mult = 1000;

    if (!isNaN(base)) {
      return { value: Math.round(base * mult), raw: String(raw) };
    }
  }

  // 4. Word-based numeric parsing (e.g. "paanch lakh", "pachaas hazaar", "fifteen")
  // Guard against English verb "do" when preceded by pronouns "i", "we", "they", "you", "to"
  const tokens = text.split(/\s+/);
  let total = 0;
  let currentGroup = 0;
  let foundNumber = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const prev = i > 0 ? tokens[i - 1] : '';

    // Ignore English verb "do"
    if (token === 'do' && ['i', 'we', 'they', 'you', 'to', 'can', 'will', 'did'].includes(prev)) {
      continue;
    }

    // Check if token is digit
    if (/^\d+(?:\.\d+)?$/.test(token)) {
      currentGroup += parseFloat(token);
      foundNumber = true;
      continue;
    }

    const val = NUMBER_WORDS[token];
    if (val !== undefined) {
      foundNumber = true;
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

  if (foundNumber && total > 0) {
    return { value: total, raw: String(raw) };
  }

  // 5. Plain decimal or integer extraction without unit (e.g. "4.5", "5 years", "10")
  const plainMatch = text.match(/(\d+(?:\.\d+)?)/);
  if (plainMatch) {
    const parsed = parseFloat(plainMatch[1]);
    if (!isNaN(parsed)) {
      return { value: parsed, raw: String(raw) };
    }
  }

  return { value: null, raw: String(raw), error: 'INVALID_NUMBER_FORMAT' };
}

/**
 * Normalizes duration expressions ('15 to 20 days', '2-3 months', '1.5 months', 'one and a half month') into days.
 */
export function normalizeDurationDays(rawText: string | null | undefined): {
  days: number | null;
  error?: string;
} {
  if (!rawText) return { days: null };

  let text = String(rawText).trim().toLowerCase();
  text = normalizeDevanagariDigits(text);

  // Immediate / 0 days
  if (/(\bimmediate\b|\bturant\b|\btoday\b|\bsame day\b|\bready to join\b|\b0\s*days?\b)/i.test(text)) {
    return { days: 0 };
  }

  // Years: "1 year", "1 saal", "2 years"
  const yearMatch = text.match(/(\d+|ek|do|teen|chaar|char|paanch)\s*(?:years?|saal|varsh)/i);
  if (yearMatch) {
    const num = NUMBER_WORDS[yearMatch[1]] || parseInt(yearMatch[1], 10) || 1;
    return { days: num * 365 };
  }

  // One and a half month / derh mahina -> 45 days
  if (/(\bone and a half\b|\bderh\b|\bdedh\b)\s*(?:months?|mahina|mahine)/i.test(text)) {
    return { days: 45 };
  }

  // 1.5 months -> 45 days
  const floatMonthMatch = text.match(/(\d+\.\d+)\s*(?:months?|mahina|mahine)/i);
  if (floatMonthMatch) {
    const months = parseFloat(floatMonthMatch[1]);
    return { days: Math.round(months * 30) };
  }

  // Range of months: "2-3 months", "2 to 3 months" -> take lower bound (2 * 30 = 60 days)
  const rangeMonthMatch = text.match(/(\d+)\s*(?:-|to)\s*(\d+)\s*(?:months?|mahina|mahine)/i);
  if (rangeMonthMatch) {
    const minMonths = parseInt(rangeMonthMatch[1], 10);
    return { days: minMonths * 30 };
  }

  // Single month: "1 month", "2 months", "ek mahina", "do mahine"
  const singleMonthMatch = text.match(/(\d+|ek|do|teen|chaar|char|paanch)\s*(?:months?|mahina|mahine)/i);
  if (singleMonthMatch) {
    const num = NUMBER_WORDS[singleMonthMatch[1]] || parseInt(singleMonthMatch[1], 10) || 1;
    return { days: num * 30 };
  }

  // Range of days: "15 to 20 days", "15-20 days" -> take lower bound 15 days
  const rangeDaysMatch = text.match(/(\d+)\s*(?:-|to)\s*(\d+)\s*(?:days?|din)/i);
  if (rangeDaysMatch) {
    return { days: parseInt(rangeDaysMatch[1], 10) };
  }

  // Range of weeks: "2-3 weeks", "2 to 3 weeks" -> take lower bound 2 * 7 = 14 days
  const rangeWeeksMatch = text.match(/(\d+)\s*(?:-|to)\s*(\d+)\s*(?:weeks?|hafte|hafta)/i);
  if (rangeWeeksMatch) {
    const minWeeks = parseInt(rangeWeeksMatch[1], 10);
    return { days: minWeeks * 7 };
  }

  // Single week: "1 week", "two weeks", "do hafte"
  const singleWeekMatch = text.match(/(\d+|ek|do|teen|chaar|char|paanch|two|three)\s*(?:weeks?|hafte|hafta)/i);
  if (singleWeekMatch) {
    const num = NUMBER_WORDS[singleWeekMatch[1]] || parseInt(singleWeekMatch[1], 10) || 1;
    return { days: num * 7 };
  }

  // Single day: "15 days", "fifteen days", "30 din"
  const singleDayMatch = text.match(/(\d+|ek|do|teen|chaar|char|paanch|ten|fifteen|thirty|forty five|sixty|ninety)\s*(?:days?|din)/i);
  if (singleDayMatch) {
    const num = NUMBER_WORDS[singleDayMatch[1]] || parseInt(singleDayMatch[1], 10) || 1;
    return { days: num };
  }

  // Word numerals directly (e.g. "fifteen days notice period")
  const numParsed = normalizeMoneyOrNumber(text).value;
  if (numParsed !== null && numParsed <= 180) {
    return { days: Math.round(numParsed) };
  }

  return { days: null, error: 'UNRECOGNIZED_DURATION_FORMAT' };
}

/**
 * Normalizes relative and absolute date expressions in Asia/Kolkata timezone.
 * Disambiguates "kal" (tomorrow vs yesterday) based on grammatical tense.
 */
export function normalizeDate(
  rawText: string | null | undefined,
  referenceDate: Date = new Date()
): { date: string | null; error?: string; needsReview?: boolean } {
  if (!rawText) return { date: null };

  const text = String(rawText).trim().toLowerCase();

  // Create Date object anchored in Asia/Kolkata (UTC+5:30)
  const kolkataOffsetMs = 5.5 * 60 * 60 * 1000;
  const refKolkataTime = new Date(referenceDate.getTime() + kolkataOffsetMs);
  const targetDate = new Date(refKolkataTime);

  // 1. Relative English / Hindi keywords
  if (text.includes('aaj') || text.includes('today')) {
    return { date: targetDate.toISOString().split('T')[0] };
  }

  if (text.includes('parson') || text.includes('day after tomorrow')) {
    targetDate.setUTCDate(targetDate.getUTCDate() + 2);
    return { date: targetDate.toISOString().split('T')[0] };
  }

  if (text.includes('tomorrow')) {
    targetDate.setUTCDate(targetDate.getUTCDate() + 1);
    return { date: targetDate.toISOString().split('T')[0] };
  }

  if (text.includes('yesterday')) {
    targetDate.setUTCDate(targetDate.getUTCDate() - 1);
    return { date: targetDate.toISOString().split('T')[0] };
  }

  // Disambiguate "kal": in Hindi "kal" can mean yesterday or tomorrow
  if (/\bkal\b/i.test(text)) {
    const isPast = /(tha|thi|the|gaya|gayi|diya|liya|hua|hui|yesterday)\b/i.test(text);
    const isFuture = /(aayenge|aayega|milega|karenge|karega|hoga|hogi|tomorrow|will|shall)\b/i.test(text);

    if (isFuture) {
      targetDate.setUTCDate(targetDate.getUTCDate() + 1);
      return { date: targetDate.toISOString().split('T')[0] };
    }
    if (isPast) {
      targetDate.setUTCDate(targetDate.getUTCDate() - 1);
      return { date: targetDate.toISOString().split('T')[0] };
    }

    // Default to tomorrow in call context, but set needsReview: true
    targetDate.setUTCDate(targetDate.getUTCDate() + 1);
    return { date: targetDate.toISOString().split('T')[0], needsReview: true };
  }

  // 2. Named weekdays: "Friday", "next Monday", "somwar"
  for (const [dayName, targetDayIdx] of Object.entries(DAY_NAMES)) {
    if (new RegExp(`\\b${dayName}\\b`, 'i').test(text)) {
      const currentDay = targetDate.getUTCDay();
      let diff = targetDayIdx - currentDay;
      if (diff <= 0) diff += 7; // Next occurrence
      targetDate.setUTCDate(targetDate.getUTCDate() + diff);
      return { date: targetDate.toISOString().split('T')[0] };
    }
  }

  // 3. Absolute dates with month name: "10 November", "November 10", "15th Nov"
  for (const [mName, mIdx] of Object.entries(MONTH_NAMES)) {
    const mPattern = new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+${mName}|${mName}\\s+(\\d{1,2})(?:st|nd|rd|th)?`, 'i');
    const mMatch = text.match(mPattern);
    if (mMatch) {
      const day = parseInt(mMatch[1] || mMatch[2], 10);
      const year = targetDate.getUTCFullYear();
      const resolved = new Date(Date.UTC(year, mIdx, day));
      return { date: resolved.toISOString().split('T')[0] };
    }
  }

  // 4. Ordinal day alone: "15th", "20th"
  const ordinalMatch = text.match(/\b(\d{1,2})(?:st|nd|rd|th)\b/i);
  if (ordinalMatch) {
    const day = parseInt(ordinalMatch[1], 10);
    targetDate.setUTCDate(day);
    return { date: targetDate.toISOString().split('T')[0] };
  }

  // 5. ISO date parse
  const parsed = new Date(rawText);
  if (!isNaN(parsed.getTime())) {
    const todayStr = refKolkataTime.toISOString().split('T')[0];
    const parsedStr = parsed.toISOString().split('T')[0];
    if (parsedStr < todayStr) {
      return { date: null, error: 'PROMISED_DATE_IN_PAST' };
    }
    return { date: parsedStr };
  }

  return { date: null, error: 'UNRECOGNIZED_DATE_EXPRESSION' };
}

export function validatePhoneNumber(raw: string | null | undefined): { phone: string | null; error?: string } {
  if (!raw) return { phone: null };
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return { phone: `+91${digits}` };
  if (digits.length === 11 && digits.startsWith('0')) return { phone: `+91${digits.slice(1)}` };
  if (digits.length === 12 && digits.startsWith('91')) return { phone: `+${digits}` };
  if (digits.length < 10) return { phone: null, error: 'PHONE_TOO_SHORT' };
  return { phone: digits.length >= 7 ? `+${digits}` : null };
}

export function validateEmail(raw: string | null | undefined): { email: string | null; error?: string } {
  if (!raw) return { email: null };
  const clean = raw.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(clean) ? { email: clean } : { email: null, error: 'INVALID_EMAIL' };
}

export function validatePostalPinCode(raw: string | null | undefined): { pinCode: string | null; error?: string } {
  if (!raw) return { pinCode: null };
  const digits = raw.replace(/\D/g, '');
  if (/^[1-9][0-9]{5}$/.test(digits)) {
    return { pinCode: digits };
  }
  return { pinCode: null, error: 'INVALID_PIN_CODE' };
}

export function validateEnum(raw: string | null | undefined, options: string[] = []): { value: string | null; error?: string } {
  if (!raw || options.length === 0) return { value: null };
  const clean = raw.trim().toLowerCase();
  const match = options.find((opt) => opt.toLowerCase() === clean);
  return match ? { value: match } : { value: null, error: 'OUT_OF_RANGE' };
}
