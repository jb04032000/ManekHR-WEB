/**
 * Money and Precision Policy (spec Section 6.5) - front-end mirror of
 * crewroster-backend/src/modules/finance/common/precision.ts. Keep the two in sync
 * byte-for-byte so the invoice preview matches the server snapshot at Post.
 */

export const PAISE_PER_RUPEE = 100;

export function roundPaise(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

export function gstHalves(
  taxablePaise: number,
  ratePercent: number,
): { cgstPaise: number; sgstPaise: number } {
  const half = roundPaise((taxablePaise * (ratePercent / 2)) / 100);
  return { cgstPaise: half, sgstPaise: half };
}

export function igstPaise(taxablePaise: number, ratePercent: number): number {
  return roundPaise((taxablePaise * ratePercent) / 100);
}

/**
 * Rate is stored at up to 4 decimal places of a rupee, as an integer count of
 * 1/10000-rupee units (centi-paise = 1/100 paise). A legacy 2-dp ratePaise
 * upscales as ratePaise * 100. See spec Section 6.5 item 2.
 */
export const CENTIPAISE_PER_PAISE = 100;

/** Effective rate in centi-paise: prefer the 4-dp rateCentiPaise, else upscale ratePaise. */
export function effectiveRateCentiPaise(line: {
  rateCentiPaise?: number | null;
  ratePaise: number;
}): number {
  return line.rateCentiPaise != null ? line.rateCentiPaise : line.ratePaise * CENTIPAISE_PER_PAISE;
}

/** Line amount in paise = qty x rate, rate given in centi-paise. Rounds once. */
export function lineAmountPaise(qty: number, rateCentiPaise: number): number {
  return roundPaise((qty * rateCentiPaise) / CENTIPAISE_PER_PAISE);
}

/** Convert a rupee rate (up to 4 dp) to integer centi-paise. */
export function rateCentiPaiseFromRupees(rupees: number): number {
  return roundPaise(rupees * 10000);
}

/** Rounded 2-dp display paise from centi-paise (the ratePaise display mirror). */
export function ratePaiseFromCentiPaise(rateCentiPaise: number): number {
  return roundPaise(rateCentiPaise / CENTIPAISE_PER_PAISE);
}
