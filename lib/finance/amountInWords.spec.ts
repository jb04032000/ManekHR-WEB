import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { amountInWords } from './amountInWords.js';

describe('amountInWords', () => {
  it('returns "Rupees Zero Only" for 0 paise', () => {
    assert.equal(amountInWords(0), 'Rupees Zero Only');
  });

  it('returns "Rupees One Only" for 100 paise (1.00 INR)', () => {
    assert.equal(amountInWords(100), 'Rupees One Only');
  });

  it('returns lakh-crore format for 12345678 paise', () => {
    assert.equal(
      amountInWords(12345678),
      'Rupees One Lakh Twenty-Three Thousand Four Hundred Fifty-Six and Seventy-Eight Paise Only',
    );
  });

  it('returns "Rupees One Crore Only" for 1000000000 paise (1 crore INR = 1,00,00,000 rupees)', () => {
    assert.equal(amountInWords(1000000000), 'Rupees One Crore Only');
  });

  it('returns paise-only string when rupees == 0 and paise > 0', () => {
    assert.equal(amountInWords(50), 'Fifty Paise Only');
  });

  it('returns empty string for negative input', () => {
    assert.equal(amountInWords(-100), '');
  });

  it('omits "and Zero Paise" clause when paise remainder is 0', () => {
    assert.equal(amountInWords(5000000), 'Rupees Fifty Thousand Only');
  });

  it('handles large rupee amounts correctly (12 lakh 34 thousand 500)', () => {
    assert.equal(
      amountInWords(123450000),
      'Rupees Twelve Lakh Thirty-Four Thousand Five Hundred Only',
    );
  });
});
