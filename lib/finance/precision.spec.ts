import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  roundPaise,
  gstHalves,
  igstPaise,
  PAISE_PER_RUPEE,
  effectiveRateCentiPaise,
  lineAmountPaise,
  rateCentiPaiseFromRupees,
  ratePaiseFromCentiPaise,
  CENTIPAISE_PER_PAISE,
} from './precision.js';

test('roundPaise rounds half away from zero', () => {
  assert.equal(roundPaise(2.5), 3);
  assert.equal(roundPaise(-2.5), -3);
  assert.equal(roundPaise(0.5), 1);
  assert.equal(roundPaise(-0.5), -1);
  assert.equal(roundPaise(2.4), 2);
  assert.equal(roundPaise(0), 0);
  assert.equal(PAISE_PER_RUPEE, 100);
});

test('gstHalves splits into equal halves (matches backend)', () => {
  assert.deepEqual(gstHalves(20000, 5), { cgstPaise: 500, sgstPaise: 500 });
  assert.deepEqual(gstHalves(10100, 5), { cgstPaise: 253, sgstPaise: 253 });
});

test('igstPaise computes full rate', () => {
  assert.equal(igstPaise(20000, 5), 1000);
  assert.equal(igstPaise(10050, 18), 1809);
});

test('CENTIPAISE_PER_PAISE is 100', () => {
  assert.equal(CENTIPAISE_PER_PAISE, 100);
});

test('rateCentiPaiseFromRupees captures 4 dp', () => {
  assert.equal(rateCentiPaiseFromRupees(10.1113), 101113);
  assert.equal(rateCentiPaiseFromRupees(10.005), 100050);
});

test('lineAmountPaise Rs 10.005 x 100 = 100050 paise (4 dp)', () => {
  assert.equal(lineAmountPaise(100, 100050), 100050);
});

test('effectiveRateCentiPaise back-compat upscales ratePaise', () => {
  assert.equal(effectiveRateCentiPaise({ ratePaise: 1011 }), 101100);
});

test('ratePaiseFromCentiPaise rounded 2-dp display mirror', () => {
  assert.equal(ratePaiseFromCentiPaise(100050), 1001);
  assert.equal(ratePaiseFromCentiPaise(101113), 1011);
});
