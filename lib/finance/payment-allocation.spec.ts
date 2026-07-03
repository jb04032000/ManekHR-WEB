import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { planFifoAllocation, planSettleInFull } from './payment-allocation';

const due = (id: string, paise: number, dueDate?: string) => ({
  id,
  amountDuePaise: paise,
  dueDate,
});

describe('planFifoAllocation - distribute a payment oldest-first', () => {
  it('returns nothing for a zero or negative total', () => {
    assert.deepEqual(planFifoAllocation([due('a', 10000)], 0), []);
    assert.deepEqual(planFifoAllocation([due('a', 10000)], -5), []);
  });

  it('partially allocates the first due when the total is smaller', () => {
    const out = planFifoAllocation([due('a', 10000, '2025-01-01')], 4000);
    assert.deepEqual(out, [{ id: 'a', allocatedPaise: 4000 }]);
  });

  it('fills the first due then partially the next (FIFO)', () => {
    const out = planFifoAllocation(
      [due('a', 10000, '2025-01-01'), due('b', 10000, '2025-02-01')],
      15000,
    );
    assert.deepEqual(out, [
      { id: 'a', allocatedPaise: 10000 },
      { id: 'b', allocatedPaise: 5000 },
    ]);
  });

  it('allocates strictly oldest-first regardless of input order', () => {
    const out = planFifoAllocation(
      [due('newer', 10000, '2025-03-01'), due('older', 10000, '2025-01-01')],
      6000,
    );
    assert.deepEqual(out, [{ id: 'older', allocatedPaise: 6000 }]);
  });

  it('caps total allocation at the sum of dues (excess is advance credit)', () => {
    const out = planFifoAllocation(
      [due('a', 10000, '2025-01-01'), due('b', 5000, '2025-02-01')],
      20000,
    );
    assert.deepEqual(out, [
      { id: 'a', allocatedPaise: 10000 },
      { id: 'b', allocatedPaise: 5000 },
    ]);
  });

  it('skips zero-due rows', () => {
    const out = planFifoAllocation([due('a', 0, '2025-01-01'), due('b', 8000, '2025-02-01')], 5000);
    assert.deepEqual(out, [{ id: 'b', allocatedPaise: 5000 }]);
  });
});

describe('planSettleInFull - pay every outstanding due in full', () => {
  it('allocates each due its full amount and reports the total', () => {
    const r = planSettleInFull([due('a', 10000), due('b', 5000)]);
    assert.deepEqual(r.allocations, [
      { id: 'a', allocatedPaise: 10000 },
      { id: 'b', allocatedPaise: 5000 },
    ]);
    assert.equal(r.totalPaise, 15000);
  });

  it('skips zero-due rows and totals only positive dues', () => {
    const r = planSettleInFull([due('a', 0), due('b', 7000)]);
    assert.deepEqual(r.allocations, [{ id: 'b', allocatedPaise: 7000 }]);
    assert.equal(r.totalPaise, 7000);
  });
});
