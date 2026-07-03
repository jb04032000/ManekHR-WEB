/**
 * Trial day-count helper — the SINGLE source of truth so every trial surface
 * shows the same number.
 *
 * What it does: counts whole CALENDAR days between "now" and the trial end date,
 * both normalized to local midnight. This is stable across time-of-day and
 * immune to small client/server clock skew, so a 45-day trial reliably reads
 * "45" — never "46". (A raw `Math.ceil((end - now) / DAY)` rounds 45.00x up to 46
 * on reload, because the server-set end date is a hair beyond the client's
 * "now".) It also matches the human-readable "Ends <date>" shown alongside.
 *
 * Cross-module links: used by components/subscription/TrialStatusBanner.tsx (the
 * in-app plans hub status card) and components/subscription/TrialBanners.tsx (the
 * global dashboard reminder) so the two can never disagree.
 *
 * Watch: pass a STABLE `nowMs` (captured once at mount) from the caller so the
 * render stays pure (react-hooks/purity) — day-granularity surfaces never need a
 * live clock.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDayMs(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function trialDaysLeft(
  endsAt: string | number | Date | null | undefined,
  nowMs: number,
): number {
  if (endsAt == null) return 0;
  const end = endsAt instanceof Date ? endsAt : new Date(endsAt);
  if (Number.isNaN(end.getTime())) return 0;
  const today = startOfLocalDayMs(new Date(nowMs));
  const endDay = startOfLocalDayMs(end);
  // round (not ceil/floor) absorbs the ±1h DST wobble between two local midnights.
  return Math.max(0, Math.round((endDay - today) / DAY_MS));
}
