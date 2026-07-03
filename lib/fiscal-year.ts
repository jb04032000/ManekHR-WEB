/**
 * Client-side fiscal-year helpers - mirrors
 * `manekhr-backend/src/modules/finance/common/fiscal-year.util.ts`.
 *
 * Used for client-side validation in the Tally Export form (Phase 16 Plan 06).
 * Server is authoritative - `assertSameFy` runs again on POST. This client
 * version is purely UX (disable the CTA + show inline hint before the round-trip).
 */
export interface FiscalYearWindow {
  startYear: number;
  startDate: Date;
  endDate: Date;
}

export function getFiscalYearOfDate(date: Date, fyStartMonth: number /* 1-12 */): FiscalYearWindow {
  const m = date.getUTCMonth() + 1;
  const y = date.getUTCFullYear();
  const startYear = m >= fyStartMonth ? y : y - 1;
  const startDate = new Date(Date.UTC(startYear, fyStartMonth - 1, 1, 0, 0, 0, 0));
  const endExclusive = Date.UTC(startYear + 1, fyStartMonth - 1, 1, 0, 0, 0, 0);
  const endDate = new Date(endExclusive - 1);
  return { startYear, startDate, endDate };
}

/**
 * True iff `from` and `to` fall within the same fiscal year.
 * Used to enable/disable the "Generate XML" CTA.
 */
export function isSameFiscalYear(from: Date, to: Date, fyStartMonth: number): boolean {
  if (from.getTime() > to.getTime()) return false;
  const a = getFiscalYearOfDate(from, fyStartMonth);
  const b = getFiscalYearOfDate(to, fyStartMonth);
  return a.startYear === b.startYear;
}

/**
 * Returns the [start, today] window for the fiscal year that contains `today`.
 * Used as the default RangePicker value on the Tally Export form.
 */
export function defaultFyRange(today: Date, fyStartMonth: number): { start: Date; end: Date } {
  const win = getFiscalYearOfDate(today, fyStartMonth);
  return { start: win.startDate, end: today };
}
