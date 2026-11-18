/**
 * One CSV cell, quoted, and safe to open in Excel / Google Sheets: text starting with = + - @
 * (or a tab / carriage return) is prefixed with ' so it is shown as text, never run as a formula.
 */
export function sanitizeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let s = String(val);
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  return `"${s.replace(/"/g, '""')}"`;
}

export function csvLine(values: unknown[]): string {
  return values.map(sanitizeCsvCell).join(',');
}
