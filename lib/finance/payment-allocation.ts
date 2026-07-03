/**
 * Pure payment-allocation planners shared by the receipt + payment-out
 * allocation tables. Keeping the money logic here (no React, no AntD) lets it be
 * unit-tested and reused across both surfaces.
 */

export interface AllocatableDue {
  /** Stable id of the invoice/bill being paid. */
  id: string;
  /** Outstanding amount on the document, in paise. */
  amountDuePaise: number;
  /** Used to order FIFO (oldest first). Absent dates sort first. */
  dueDate?: string | number | Date | null;
}

export interface PlannedAllocation {
  id: string;
  allocatedPaise: number;
}

function dueTime(d: AllocatableDue['dueDate']): number {
  if (d === undefined || d === null) return 0;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Distribute `totalPaise` across the dues oldest-first (FIFO), capping each at
 * its outstanding amount. Any excess (total greater than the sum of dues) is
 * left unallocated - it surfaces in the form as advance credit. Zero/negative
 * dues are skipped. Pure: does not mutate `dues`.
 */
export function planFifoAllocation(
  dues: AllocatableDue[],
  totalPaise: number,
): PlannedAllocation[] {
  if (totalPaise <= 0) return [];
  const sorted = [...dues].sort((a, b) => dueTime(a.dueDate) - dueTime(b.dueDate));
  let remaining = totalPaise;
  const out: PlannedAllocation[] = [];
  for (const d of sorted) {
    if (remaining <= 0) break;
    const allocatedPaise = Math.min(remaining, Math.max(0, d.amountDuePaise));
    if (allocatedPaise > 0) {
      out.push({ id: d.id, allocatedPaise });
      remaining -= allocatedPaise;
    }
  }
  return out;
}

/**
 * Allocate every due its full outstanding amount. Returns the per-due
 * allocations plus the total required (so the form can set the payment amount
 * to match). Zero/negative dues are skipped.
 */
export function planSettleInFull(dues: AllocatableDue[]): {
  allocations: PlannedAllocation[];
  totalPaise: number;
} {
  const allocations = dues
    .filter((d) => d.amountDuePaise > 0)
    .map((d) => ({ id: d.id, allocatedPaise: d.amountDuePaise }));
  const totalPaise = allocations.reduce((s, a) => s + a.allocatedPaise, 0);
  return { allocations, totalPaise };
}
