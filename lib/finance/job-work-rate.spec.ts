import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveJobWorkRate, JOB_WORK_TYPES, JOB_WORK_TYPE_LABELS } from './job-work-rate';

describe('resolveJobWorkRate (mirrors backend SAC 9988 rates)', () => {
  it('general textile job-work is 5%', () => {
    assert.equal(resolveJobWorkRate('general_textile'), 5);
  });

  it('dyeing/printing is 18%', () => {
    assert.equal(resolveJobWorkRate('dyeing_printing'), 18);
  });

  it('printing is 18% and embroidery is 5% (R5 process split)', () => {
    assert.equal(resolveJobWorkRate('printing'), 18);
    assert.equal(resolveJobWorkRate('embroidery'), 5);
  });

  it('residuary/other is 18%', () => {
    assert.equal(resolveJobWorkRate('other'), 18);
  });

  it('defaults to 5% when the type is missing or unknown (matches backend default)', () => {
    assert.equal(resolveJobWorkRate(undefined), 5);
    assert.equal(resolveJobWorkRate('nonsense'), 5);
  });
});

describe('job-work type options', () => {
  it('exposes all process types with labels for the picker', () => {
    assert.deepEqual(JOB_WORK_TYPES, [
      'general_textile',
      'embroidery',
      'dyeing_printing',
      'printing',
      'other',
    ]);
    for (const t of JOB_WORK_TYPES) {
      assert.ok(JOB_WORK_TYPE_LABELS[t].length > 0);
    }
  });
});
