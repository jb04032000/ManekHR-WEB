// Tests for allocateAdvancePool - pure pro-rata pool allocation util.
// TDD: written BEFORE the implementation to prove each rule. All amounts in paise.
// Plan: docs/superpowers/plans/2026-06-22-advance-budget-pool.md Task 1.

import { describe, it, expect } from 'vitest';
import { allocateAdvancePool } from './allocateAdvancePool';

describe('allocateAdvancePool', () => {
  // Rule: empty requests → empty allocations, leftover = pool, total = 0
  it('returns empty allocations with full pool as leftover when no requests', () => {
    const result = allocateAdvancePool(30000000, [], 10000);
    expect(result.allocations).toEqual([]);
    expect(result.totalAllocatedPaise).toBe(0);
    expect(result.leftoverPaise).toBe(30000000);
  });

  // Rule: pool >= total requested → everyone gets their full requestedPaise;
  //       leftover = pool − totalRequested; no unnecessary rounding-down
  it('gives every request its full amount when pool covers total', () => {
    const result = allocateAdvancePool(
      50000000, // ₹5,00,000 pool
      [
        { id: 'r1', requestedPaise: 20000000 }, // ₹2,00,000
        { id: 'r2', requestedPaise: 20000000 }, // ₹2,00,000
      ],
      10000, // roundTo ₹100
    );
    expect(result.allocations).toEqual([
      { id: 'r1', allocatedPaise: 20000000 },
      { id: 'r2', allocatedPaise: 20000000 },
    ]);
    expect(result.totalAllocatedPaise).toBe(40000000);
    expect(result.leftoverPaise).toBe(10000000); // ₹1,00,000 leftover
  });

  // Rule: pool exactly equals total requested → zero leftover
  it('returns zero leftover when pool equals total requested', () => {
    const result = allocateAdvancePool(
      30000000, // ₹3,00,000
      [
        { id: 'a', requestedPaise: 10000000 },
        { id: 'b', requestedPaise: 20000000 },
      ],
      10000,
    );
    expect(result.allocations[0].allocatedPaise).toBe(10000000);
    expect(result.allocations[1].allocatedPaise).toBe(20000000);
    expect(result.leftoverPaise).toBe(0);
  });

  // Rule: pool < total → pro-rata floor-rounded; plan example:
  //   pool ₹3,00,000 (30000000 paise), requests [₹2,00,000, ₹3,00,000] total ₹5,00,000
  //   raw: 30000000*20000000/50000000 = 12000000 (₹1,20,000) → already clean
  //         30000000*30000000/50000000 = 18000000 (₹1,80,000) → already clean
  //   sum = 30000000, leftover = 0
  it('allocates pro-rata rounded down to roundTo when pool < total (clean-ratio case from plan)', () => {
    const result = allocateAdvancePool(
      30000000, // ₹3,00,000
      [
        { id: 'req1', requestedPaise: 20000000 }, // ₹2,00,000
        { id: 'req2', requestedPaise: 30000000 }, // ₹3,00,000
      ],
      10000, // roundTo ₹100
    );
    expect(result.allocations[0]).toEqual({ id: 'req1', allocatedPaise: 12000000 });
    expect(result.allocations[1]).toEqual({ id: 'req2', allocatedPaise: 18000000 });
    expect(result.totalAllocatedPaise).toBe(30000000);
    expect(result.leftoverPaise).toBe(0);
  });

  // Rule: pool < total, non-clean ratio → floor-round-down + leftover > 0
  //   pool ₹1,00,000 (10000000 paise), requests [₹70,000, ₹50,000] total ₹1,20,000
  //   raw1 = 10000000 * 70000 / 120000 = 5833333.33... → floor/10000*10000 = 5830000 (₹58,300)
  //   raw2 = 10000000 * 50000 / 120000 = 4166666.66... → floor/10000*10000 = 4160000 (₹41,600)
  //   sum = 9990000, leftover = 10000000 - 9990000 = 10000
  it('floors non-clean ratios to roundTo and produces correct leftover', () => {
    const result = allocateAdvancePool(
      10000000, // ₹1,00,000
      [
        { id: 'x', requestedPaise: 7000000 }, // ₹70,000
        { id: 'y', requestedPaise: 5000000 }, // ₹50,000
      ],
      10000,
    );
    // Verify round-down (not round-up or round-nearest)
    expect(result.allocations[0].allocatedPaise).toBe(5830000); // ₹58,300
    expect(result.allocations[1].allocatedPaise).toBe(4160000); // ₹41,600
    expect(result.totalAllocatedPaise).toBe(9990000);
    expect(result.leftoverPaise).toBe(10000); // ₹100 leftover
  });

  // Rule: allocated never exceeds requested (cap at requested even if formula could)
  it('caps each allocation at the requested amount', () => {
    // large pool, tiny request: raw pro-rata > requested
    const result = allocateAdvancePool(
      100000000, // ₹10,00,000 pool (way bigger than total ₹5,000)
      [{ id: 'z', requestedPaise: 500000 }], // ₹5,000
      10000,
    );
    // pool >= total, so full allocation = requestedPaise, never above
    expect(result.allocations[0].allocatedPaise).toBe(500000);
    expect(result.leftoverPaise).toBe(99500000);
  });

  // Rule: no negative allocations even if pool = 0
  it('allocates zero to everyone when pool is 0', () => {
    const result = allocateAdvancePool(
      0,
      [
        { id: 'a', requestedPaise: 10000000 },
        { id: 'b', requestedPaise: 5000000 },
      ],
      10000,
    );
    expect(result.allocations[0].allocatedPaise).toBe(0);
    expect(result.allocations[1].allocatedPaise).toBe(0);
    expect(result.totalAllocatedPaise).toBe(0);
    expect(result.leftoverPaise).toBe(0);
  });

  // Rule: sum(alloc) ≤ pool always (invariant check across many allocations)
  it('never lets sum of allocations exceed the pool', () => {
    const pool = 7777700;
    const requests = [
      { id: '1', requestedPaise: 3000000 },
      { id: '2', requestedPaise: 4000000 },
      { id: '3', requestedPaise: 2500000 },
    ];
    const result = allocateAdvancePool(pool, requests, 10000);
    expect(result.totalAllocatedPaise).toBeLessThanOrEqual(pool);
    expect(result.leftoverPaise).toBeGreaterThanOrEqual(0);
    expect(result.totalAllocatedPaise + result.leftoverPaise).toBe(pool);
  });

  // Rule: uses default roundTo = 10000 (₹100) when not supplied
  it('defaults roundTo to 10000 paise (₹100)', () => {
    const result = allocateAdvancePool(
      10000000,
      [
        { id: 'p', requestedPaise: 7000000 },
        { id: 'q', requestedPaise: 5000000 },
      ],
      // no roundTo arg
    );
    // result should be same as with explicit 10000
    const explicit = allocateAdvancePool(
      10000000,
      [
        { id: 'p', requestedPaise: 7000000 },
        { id: 'q', requestedPaise: 5000000 },
      ],
      10000,
    );
    expect(result).toEqual(explicit);
  });

  // Rule: deterministic — same inputs always produce same outputs
  it('is deterministic (same output for same input)', () => {
    const inputs = {
      pool: 25000000,
      requests: [
        { id: 'a', requestedPaise: 10000000 },
        { id: 'b', requestedPaise: 8000000 },
        { id: 'c', requestedPaise: 12000000 },
      ],
      roundTo: 10000,
    };
    const r1 = allocateAdvancePool(inputs.pool, inputs.requests, inputs.roundTo);
    const r2 = allocateAdvancePool(inputs.pool, inputs.requests, inputs.roundTo);
    expect(r1).toEqual(r2);
  });
});
