import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { visibleSalarySections, SALARY_SECTIONS } from '../salarySections';

describe('visibleSalarySections', () => {
  it('always includes summary, pay, structure', () => {
    const out = visibleSalarySections(() => false).map((s) => s.key);
    assert.deepEqual(out, ['summary', 'pay', 'structure']);
  });

  it('includes a gated section only when its feature is enabled', () => {
    const loanKey = SALARY_SECTIONS.find((s) => s.key === 'loans')!.featureKey!;
    const out = visibleSalarySections((f) => f === loanKey).map((s) => s.key);
    assert.ok(out.includes('loans'));
    assert.ok(!out.includes('commission'));
  });

  it('lists all sections when everything is enabled', () => {
    assert.equal(visibleSalarySections(() => true).length, SALARY_SECTIONS.length);
  });
});
