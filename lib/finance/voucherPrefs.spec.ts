import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseVoucherPrefs } from './voucherPrefs';

describe('parseVoucherPrefs', () => {
  it('returns {} for null/empty/garbage', () => {
    assert.deepEqual(parseVoucherPrefs(null), {});
    assert.deepEqual(parseVoucherPrefs(''), {});
    assert.deepEqual(parseVoucherPrefs('{not json'), {});
  });

  it('keeps valid dueDays + placeOfSupplyStateCode', () => {
    assert.deepEqual(parseVoucherPrefs('{"dueDays":30,"placeOfSupplyStateCode":"27"}'), {
      dueDays: 30,
      placeOfSupplyStateCode: '27',
    });
  });

  it('drops wrong-typed or negative values', () => {
    assert.deepEqual(parseVoucherPrefs('{"dueDays":-5,"placeOfSupplyStateCode":24}'), {});
    assert.deepEqual(parseVoucherPrefs('{"dueDays":"30"}'), {});
  });

  it('accepts dueDays 0 (Immediate)', () => {
    assert.deepEqual(parseVoucherPrefs('{"dueDays":0}'), { dueDays: 0 });
  });
});
