/**
 * One CSV cell, quoted, and safe to open in Excel / Google Sheets: text starting with = + - @
 * (or a tab / carriage return) is prefixed with ' so it is shown as text, never run as a formula
 * (call summaries and contact/campaign names come from callers and users). Same rule as the
 * server's report export.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(',');
}
