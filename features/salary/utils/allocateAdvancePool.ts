// Pure pro-rata budget-pool allocation util for advance salary requests.
// All amounts are in paise (integers). Deterministic; no Date/Math.random.
// Plan: docs/superpowers/plans/2026-06-22-advance-budget-pool.md Task 1.
// Links: AdvanceAllocationPanel (Task 2), approveAdvanceRequest (salary.api.ts).
// Watch: roundTo is in paise (10000 paise = ₹100); callers must pass amounts in paise.

export interface AllocInput {
  id: string;
  requestedPaise: number;
}

export interface AllocResult {
  id: string;
  allocatedPaise: number;
}

export interface AllocOutput {
  allocations: AllocResult[];
  totalAllocatedPaise: number;
  leftoverPaise: number;
}

/**
 * Splits poolPaise across requests pro-rata by each request's requestedPaise,
 * rounding each allocation DOWN to the nearest roundToPaise (default ₹100 = 10000 paise).
 *
 * Rules:
 * - If pool >= totalRequested: each request gets its full requestedPaise (no round-down).
 * - If pool < totalRequested: alloc_i = floor((pool * requested_i / total) / roundTo) * roundTo
 *   then capped at requestedPaise so we never over-allocate one request.
 * - sum(alloc) <= pool always (floor guarantees it).
 * - leftover = pool - sum(alloc) >= 0.
 * - Never negative.
 */
export function allocateAdvancePool(
  poolPaise: number,
  requests: AllocInput[],
  roundToPaise = 10000, // ₹100
): AllocOutput {
  if (requests.length === 0) {
    return { allocations: [], totalAllocatedPaise: 0, leftoverPaise: poolPaise };
  }

  const totalRequested = requests.reduce((sum, r) => sum + r.requestedPaise, 0);

  // Pool covers everyone: give full amounts, no rounding-down applied.
  if (poolPaise >= totalRequested) {
    const allocations: AllocResult[] = requests.map((r) => ({
      id: r.id,
      allocatedPaise: r.requestedPaise,
    }));
    return {
      allocations,
      totalAllocatedPaise: totalRequested,
      leftoverPaise: poolPaise - totalRequested,
    };
  }

  // Pool < total: pro-rata floor-rounded.
  // Use integer arithmetic to avoid floating-point drift:
  //   raw = floor((poolPaise * requestedPaise) / totalRequested / roundToPaise) * roundToPaise
  // Never exceeds requestedPaise (pool < total means raw <= requestedPaise).
  const allocations: AllocResult[] = requests.map((r) => {
    if (totalRequested === 0 || poolPaise === 0) {
      return { id: r.id, allocatedPaise: 0 };
    }
    // Compute numerator first as a large integer multiplication, then floor-divide.
    const numerator = poolPaise * r.requestedPaise;
    const raw = Math.floor(numerator / totalRequested);
    // Round down to nearest roundToPaise multiple.
    const rounded = Math.floor(raw / roundToPaise) * roundToPaise;
    // Cap at requested (should already hold, but enforces the invariant explicitly).
    const allocated = Math.min(rounded, r.requestedPaise);
    return { id: r.id, allocatedPaise: Math.max(0, allocated) };
  });

  const totalAllocatedPaise = allocations.reduce((s, a) => s + a.allocatedPaise, 0);
  const leftoverPaise = poolPaise - totalAllocatedPaise;

  return { allocations, totalAllocatedPaise, leftoverPaise };
}
