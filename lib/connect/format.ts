/**
 * Connect formatting helpers.
 *
 * Money is stored in **paise** (integer) ERP-wide - convert + format here so
 * every Connect surface shows Indian-numbered rupees (ENGINEERING-STANDARDS #9).
 */

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** Integer paise → Indian-numbered rupees, e.g. `8500000` → `"₹85,000"`. */
export function formatRupeesFromPaise(paise: number): string {
  return INR.format(Math.round(paise) / 100);
}

/** A date → short `"Mon YYYY"` label, e.g. `"Jan 2024"`. */
export function formatMonthYear(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(d);
}
