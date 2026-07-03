import { describe, it, expect } from 'vitest';
import {
  buildListingBoostInput,
  buildJobBoostInput,
  buildPostBoostInput,
  buildOpenToWorkBoostInput,
  buildHiringBoostInput,
  buildRfqBoostInput,
  boostSubmitBlockReason,
  parseBudgetInput,
  parseDurationInput,
  BOOST_MIN_BUDGET,
  BOOST_DURATION_MIN,
  BOOST_DURATION_MAX,
  type BoostFormState,
} from './boost-composer-logic';
import type { WalletView } from './ads.types';

const baseState: BoostFormState = {
  objective: 'reach',
  roles: [],
  sectors: [],
  districts: [],
  budget: 299,
  days: 7,
  spotlight: false,
};

describe('boostSubmitBlockReason', () => {
  it('returns budget_below_min when budget is 50 (below 99)', () => {
    const state = { ...baseState, budget: 50 };
    expect(boostSubmitBlockReason(state, null)).toBe('budget_below_min');
  });

  it('returns budget_below_min when budget is 0', () => {
    const state = { ...baseState, budget: 0 };
    expect(boostSubmitBlockReason(state, null)).toBe('budget_below_min');
  });

  it('returns budget_below_min when budget is 98 (one below floor)', () => {
    const state = { ...baseState, budget: 98 };
    expect(boostSubmitBlockReason(state, null)).toBe('budget_below_min');
  });

  it('returns null at exact minimum budget with null wallet', () => {
    const state = { ...baseState, budget: BOOST_MIN_BUDGET };
    expect(boostSubmitBlockReason(state, null)).toBeNull();
  });

  it('returns insufficient_balance when budget 300 and wallet.balance is 100', () => {
    const wallet: WalletView = { balance: 100, reserved: 0 };
    const state = { ...baseState, budget: 300 };
    expect(boostSubmitBlockReason(state, wallet)).toBe('insufficient_balance');
  });

  it('returns null when budget 300 and wallet.balance is 1000', () => {
    const wallet: WalletView = { balance: 1000, reserved: 0 };
    const state = { ...baseState, budget: 300 };
    expect(boostSubmitBlockReason(state, wallet)).toBeNull();
  });

  it('returns null when budget 300 and wallet is null (server is source of truth)', () => {
    const state = { ...baseState, budget: 300 };
    expect(boostSubmitBlockReason(state, null)).toBeNull();
  });

  it('returns null at exact boundary: budget 99 and balance 99', () => {
    const wallet: WalletView = { balance: 99, reserved: 0 };
    const state = { ...baseState, budget: 99 };
    expect(boostSubmitBlockReason(state, wallet)).toBeNull();
  });

  it('budget_below_min takes priority over insufficient_balance', () => {
    const wallet: WalletView = { balance: 50, reserved: 0 };
    const state = { ...baseState, budget: 50 };
    expect(boostSubmitBlockReason(state, wallet)).toBe('budget_below_min');
  });

  // CN-ADS-4: the gate reads balance + grantBalance (grant-first spend).
  it('allows the boost when grant credits cover the budget (balance 0, grant 500, budget 300)', () => {
    const wallet: WalletView = { balance: 0, reserved: 0, grantBalance: 500 };
    const state = { ...baseState, budget: 300 };
    expect(boostSubmitBlockReason(state, wallet)).toBeNull();
  });

  it('still blocks when balance + grant is short (balance 0, grant 100, budget 300)', () => {
    const wallet: WalletView = { balance: 0, reserved: 0, grantBalance: 100 };
    const state = { ...baseState, budget: 300 };
    expect(boostSubmitBlockReason(state, wallet)).toBe('insufficient_balance');
  });

  it('sums balance + grant to clear the budget (balance 150, grant 200, budget 300)', () => {
    const wallet: WalletView = { balance: 150, reserved: 0, grantBalance: 200 };
    const state = { ...baseState, budget: 300 };
    expect(boostSubmitBlockReason(state, wallet)).toBeNull();
  });

  it('treats a missing grantBalance as 0 (back-compat)', () => {
    const wallet: WalletView = { balance: 100, reserved: 0 };
    const state = { ...baseState, budget: 300 };
    expect(boostSubmitBlockReason(state, wallet)).toBe('insufficient_balance');
  });
});

describe('parseBudgetInput', () => {
  // Empty / whitespace
  it('returns empty error for empty string', () => {
    expect(parseBudgetInput('')).toEqual({ value: null, error: 'empty' });
  });

  it('returns empty error for whitespace-only string', () => {
    expect(parseBudgetInput('   ')).toEqual({ value: null, error: 'empty' });
  });

  // Non-numeric
  it('returns not_a_number for alphabetic input', () => {
    expect(parseBudgetInput('abc')).toEqual({ value: null, error: 'not_a_number' });
  });

  it('returns not_a_number for mixed alphanumeric', () => {
    expect(parseBudgetInput('100abc')).toEqual({ value: null, error: 'not_a_number' });
  });

  it('returns not_a_number for negative number', () => {
    expect(parseBudgetInput('-50')).toEqual({ value: null, error: 'not_a_number' });
  });

  it('returns not_a_number for NaN string', () => {
    expect(parseBudgetInput('NaN')).toEqual({ value: null, error: 'not_a_number' });
  });

  // Below minimum
  it('returns below_min for 0', () => {
    expect(parseBudgetInput('0')).toEqual({ value: 0, error: 'below_min' });
  });

  it('returns below_min for 98 (one below floor)', () => {
    expect(parseBudgetInput('98')).toEqual({ value: 98, error: 'below_min' });
  });

  it('returns below_min for 98.5 (rounds to 99 but check is on rounded value)', () => {
    // 98.5 rounds to 99 which equals BOOST_MIN_BUDGET, so no error
    expect(parseBudgetInput('98.5')).toEqual({ value: 99, error: null });
  });

  it('returns below_min for 98.4 (rounds to 98, below floor)', () => {
    expect(parseBudgetInput('98.4')).toEqual({ value: 98, error: 'below_min' });
  });

  // Exact boundary
  it('returns no error at exact minimum 99', () => {
    expect(parseBudgetInput('99')).toEqual({ value: 99, error: null });
  });

  it('returns no error at exact BOOST_MIN_BUDGET constant', () => {
    expect(parseBudgetInput(String(BOOST_MIN_BUDGET))).toEqual({
      value: BOOST_MIN_BUDGET,
      error: null,
    });
  });

  // Valid amounts above floor
  it('returns no error for 299', () => {
    expect(parseBudgetInput('299')).toEqual({ value: 299, error: null });
  });

  it('returns no error for 1000', () => {
    expect(parseBudgetInput('1000')).toEqual({ value: 1000, error: null });
  });

  it('rounds a decimal to a whole rupee', () => {
    expect(parseBudgetInput('299.7')).toEqual({ value: 300, error: null });
  });

  it('trims whitespace before parsing', () => {
    expect(parseBudgetInput('  500  ')).toEqual({ value: 500, error: null });
  });
});

describe('parseDurationInput', () => {
  it('flags an empty string', () => {
    expect(parseDurationInput('')).toEqual({ value: null, error: 'empty' });
    expect(parseDurationInput('   ')).toEqual({ value: null, error: 'empty' });
  });

  it('flags non-numeric / negative input', () => {
    expect(parseDurationInput('abc')).toEqual({ value: null, error: 'not_a_number' });
    expect(parseDurationInput('10abc')).toEqual({ value: null, error: 'not_a_number' });
    expect(parseDurationInput('-5')).toEqual({ value: null, error: 'not_a_number' });
  });

  it('rejects below the minimum', () => {
    expect(parseDurationInput('0')).toEqual({ value: 0, error: 'out_of_range' });
  });

  it('rejects above the maximum', () => {
    expect(parseDurationInput(String(BOOST_DURATION_MAX + 1))).toEqual({
      value: BOOST_DURATION_MAX + 1,
      error: 'out_of_range',
    });
  });

  it('accepts the boundary values', () => {
    expect(parseDurationInput(String(BOOST_DURATION_MIN))).toEqual({
      value: BOOST_DURATION_MIN,
      error: null,
    });
    expect(parseDurationInput(String(BOOST_DURATION_MAX))).toEqual({
      value: BOOST_DURATION_MAX,
      error: null,
    });
  });

  it('accepts a custom in-range duration and rounds to a whole day', () => {
    expect(parseDurationInput('12')).toEqual({ value: 12, error: null });
    expect(parseDurationInput('9.6')).toEqual({ value: 10, error: null });
  });

  it('trims whitespace before parsing', () => {
    expect(parseDurationInput('  21  ')).toEqual({ value: 21, error: null });
  });
});

describe('buildListingBoostInput', () => {
  it('maps every field correctly (listingId-keyed)', () => {
    const state: BoostFormState = {
      objective: 'inquiries',
      roles: ['karigar'],
      sectors: ['Weaving'],
      districts: ['Surat'],
      budget: 500,
      days: 14,
      spotlight: false,
    };
    const result = buildListingBoostInput('listing-abc', state);
    expect(result.listingId).toBe('listing-abc');
    expect(result.objective).toBe('inquiries');
    expect(result.totalBudget).toBe(500);
    expect(result.days).toBe(14);
    expect(result.targeting.roles).toEqual(['karigar']);
    expect(result.targeting.sectors).toEqual(['Weaving']);
    expect(result.targeting.districts).toEqual(['Surat']);
    expect(result.targeting.companySizes).toEqual([]);
  });

  it('keeps a reach objective as reach', () => {
    const result = buildListingBoostInput('l1', { ...baseState, objective: 'reach' });
    expect(result.objective).toBe('reach');
  });

  it('coerces the post-only profile_visits objective to reach (defensive)', () => {
    const result = buildListingBoostInput('l1', { ...baseState, objective: 'profile_visits' });
    expect(result.objective).toBe('reach');
  });

  it('coerces the job-only applications objective to reach for a listing (defensive)', () => {
    const result = buildListingBoostInput('l1', { ...baseState, objective: 'applications' });
    expect(result.objective).toBe('reach');
  });
});

describe('buildJobBoostInput', () => {
  it('maps every field correctly (jobId-keyed) and keeps applications', () => {
    const result = buildJobBoostInput('job-xyz', { ...baseState, objective: 'applications' });
    expect(result.jobId).toBe('job-xyz');
    expect(result.objective).toBe('applications');
    expect(result.targeting.companySizes).toEqual([]);
  });

  it('keeps reach as reach and coerces a listing-only inquiries objective to reach', () => {
    expect(buildJobBoostInput('j1', { ...baseState, objective: 'reach' }).objective).toBe('reach');
    expect(buildJobBoostInput('j1', { ...baseState, objective: 'inquiries' }).objective).toBe(
      'reach',
    );
  });
});

describe('buildPostBoostInput', () => {
  it('maps every field correctly (postId-keyed) and keeps profile_visits', () => {
    const state: BoostFormState = {
      objective: 'profile_visits',
      roles: ['buyer'],
      sectors: ['Printing'],
      districts: ['Ahmedabad'],
      budget: 700,
      days: 30,
      spotlight: false,
    };
    const result = buildPostBoostInput('post-xyz', state);
    expect(result.postId).toBe('post-xyz');
    expect(result.objective).toBe('profile_visits');
    expect(result.totalBudget).toBe(700);
    expect(result.days).toBe(30);
    expect(result.targeting.roles).toEqual(['buyer']);
    expect(result.targeting.sectors).toEqual(['Printing']);
    expect(result.targeting.districts).toEqual(['Ahmedabad']);
    expect(result.targeting.companySizes).toEqual([]);
  });

  it('keeps reach as reach', () => {
    expect(buildPostBoostInput('p1', { ...baseState, objective: 'reach' }).objective).toBe('reach');
  });

  it('coerces the listing-only inquiries objective to reach (defensive)', () => {
    expect(buildPostBoostInput('p1', { ...baseState, objective: 'inquiries' }).objective).toBe(
      'reach',
    );
  });

  it('coerces the job-only applications objective to reach (defensive)', () => {
    expect(buildPostBoostInput('p1', { ...baseState, objective: 'applications' }).objective).toBe(
      'reach',
    );
  });
});

describe('buildOpenToWorkBoostInput', () => {
  it('maps reach + profile_visits; carries targeting; no id field', () => {
    const r = buildOpenToWorkBoostInput({ ...baseState, objective: 'profile_visits', budget: 500 });
    expect(r.objective).toBe('profile_visits');
    expect(r.totalBudget).toBe(500);
    expect('listingId' in r || 'rfqId' in r).toBe(false);
  });
  it('coerces a non-profile_visits objective to reach', () => {
    expect(buildOpenToWorkBoostInput({ ...baseState, objective: 'quotes' }).objective).toBe(
      'reach',
    );
  });
});

describe('buildHiringBoostInput', () => {
  it('maps reach + profile_visits', () => {
    expect(buildHiringBoostInput({ ...baseState, objective: 'profile_visits' }).objective).toBe(
      'profile_visits',
    );
    expect(buildHiringBoostInput({ ...baseState, objective: 'inquiries' }).objective).toBe('reach');
  });
});

describe('buildRfqBoostInput', () => {
  it('keys off rfqId and narrows objective to reach / quotes', () => {
    const r = buildRfqBoostInput('R1', { ...baseState, objective: 'quotes' });
    expect(r.rfqId).toBe('R1');
    expect(r.objective).toBe('quotes');
  });
  it('coerces a non-quotes objective to reach', () => {
    expect(buildRfqBoostInput('R1', { ...baseState, objective: 'applications' }).objective).toBe(
      'reach',
    );
  });
});

describe('spotlight flag passthrough', () => {
  it('carries spotlight=true into each builder', () => {
    const s = { ...baseState, spotlight: true };
    expect(buildListingBoostInput('l1', s).spotlight).toBe(true);
    expect(buildJobBoostInput('j1', s).spotlight).toBe(true);
    expect(buildPostBoostInput('p1', s).spotlight).toBe(true);
    expect(buildOpenToWorkBoostInput(s).spotlight).toBe(true);
    expect(buildHiringBoostInput(s).spotlight).toBe(true);
    expect(buildRfqBoostInput('r1', s).spotlight).toBe(true);
  });
  it('defaults spotlight=false through the builders', () => {
    expect(buildListingBoostInput('l1', baseState).spotlight).toBe(false);
    expect(buildRfqBoostInput('r1', baseState).spotlight).toBe(false);
  });
});
