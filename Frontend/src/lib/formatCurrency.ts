/**
 * Centralized currency formatting utility for Claritiy Voice Frontend.
 * Sourced from actual currency code returned by Vobiz API (default: INR).
 * Formats numbers using Intl.NumberFormat so no hardcoded currency symbols are used in components.
 */
export function formatCurrency(amount: number | null | undefined, currencyCode: string = 'INR'): string {
  const num = amount ?? 0;
  const curr = (currencyCode || 'INR').toUpperCase();
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    const symbol = curr === 'INR' ? '₹' : '$';
    return `${symbol}${num.toFixed(2)}`;
  }
}
