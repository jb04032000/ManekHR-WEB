/**
 * boost-composer-logic.ts - pure helpers for the Boost Post composer.
 *
 * No I/O, no React, no AntD. Safe to import in tests and in server code.
 *
 * MONEY UNIT: all budget / wallet balance values are WHOLE RUPEES (not paise).
 * The backend create-boost DTO uses @Min(99) rupees; bid values are ~40/~4 rupees.
 * Display amounts with "Rs " prefix or the rupee sign. No paise conversion needed.
 */

import type {
  ListingBoostInput,
  JobBoostInput,
  PostBoostInput,
  OpenToWorkBoostInput,
  HiringBoostInput,
  RfqBoostInput,
  WalletView,
} from './ads.types';

/** The campaign objectives the composer supports across target kinds. */
export type BoostObjective = 'reach' | 'inquiries' | 'profile_visits' | 'applications' | 'quotes';

/** The full form state managed by the BoostComposer. */
export interface BoostFormState {
  objective: BoostObjective;
  /** Targeting: which onboarding intents to include (empty = no restriction). */
  roles: string[];
  /** Targeting: which textile sectors to include (empty = no restriction). */
  sectors: string[];
  /** Targeting: which districts to include (empty = no restriction). */
  districts: string[];
  /** Total budget in whole rupees. Must be >= BOOST_MIN_BUDGET. */
  budget: number;
  /** Campaign run length in whole days. A preset or any custom value in
   *  [BOOST_DURATION_MIN, BOOST_DURATION_MAX] (mirrors the backend range). */
  days: number;
  /** Phase 2: optional Spotlight premium upgrade (premium rate + prime side panel). */
  spotlight: boolean;
}

/** The minimum budget in rupees (mirrors backend @Min(99) on BoostCreateDto). */
export const BOOST_MIN_BUDGET = 99;

/** Quick-pick budget amounts in rupees. */
export const BOOST_BUDGET_PRESETS = [99, 299, 500, 1000] as const;

/** Quick-pick campaign duration options. */
export const BOOST_DURATION_PRESETS = [3, 7, 14, 30] as const;

/** Custom-duration bounds in whole days (mirrors backend BOOST_DURATION_DAY_MIN/MAX). */
export const BOOST_DURATION_MIN = 1;
export const BOOST_DURATION_MAX = 365;

/**
 * Assemble the listing-boost API payload from the composer form state (M2.1).
 *
 * Keyed off `listingId`, with the objective narrowed to `reach` / `inquiries`.
 * A listing has no `profile_visits`, so that objective is coerced to `reach`
 * defensively (the composer only ever offers reach / inquiries).
 */
export function buildListingBoostInput(listingId: string, s: BoostFormState): ListingBoostInput {
  return {
    listingId,
    objective: s.objective === 'inquiries' ? 'inquiries' : 'reach',
    totalBudget: s.budget,
    days: s.days,
    spotlight: s.spotlight,
    targeting: {
      roles: s.roles,
      sectors: s.sectors,
      districts: s.districts,
      companySizes: [], // inert in v1 - backend never populates companySize
    },
  };
}

/**
 * Assemble the job-boost API payload (Phase 5). Keyed off `jobId`, objective
 * narrowed to `reach` / `applications` (a job has no inquiries/profile_visits).
 */
export function buildJobBoostInput(jobId: string, s: BoostFormState): JobBoostInput {
  return {
    jobId,
    objective: s.objective === 'applications' ? 'applications' : 'reach',
    totalBudget: s.budget,
    days: s.days,
    spotlight: s.spotlight,
    targeting: {
      roles: s.roles,
      sectors: s.sectors,
      districts: s.districts,
      companySizes: [],
    },
  };
}

/**
 * Assemble the post-boost API payload. Keyed off `postId`, objective narrowed to
 * `reach` / `profile_visits` (a post has no inquiries/applications - those are
 * the listing/job objectives). Any non-profile_visits objective is coerced to
 * `reach` defensively (the composer only offers reach / profile_visits for a
 * post). Posts to /connect/ads/boosts/post via `createPostBoost`.
 */
export function buildPostBoostInput(postId: string, s: BoostFormState): PostBoostInput {
  return {
    postId,
    objective: s.objective === 'profile_visits' ? 'profile_visits' : 'reach',
    totalBudget: s.budget,
    days: s.days,
    spotlight: s.spotlight,
    targeting: {
      roles: s.roles,
      sectors: s.sectors,
      districts: s.districts,
      companySizes: [],
    },
  };
}

/**
 * Assemble the open-to-work boost payload. No id (the target is the caller's own
 * profile). Objective narrowed to `reach` / `profile_visits`. Posts to
 * /connect/ads/boosts/open-to-work via `createOpenToWorkBoost`.
 */
export function buildOpenToWorkBoostInput(s: BoostFormState): OpenToWorkBoostInput {
  return {
    objective: s.objective === 'profile_visits' ? 'profile_visits' : 'reach',
    totalBudget: s.budget,
    days: s.days,
    spotlight: s.spotlight,
    targeting: { roles: s.roles, sectors: s.sectors, districts: s.districts, companySizes: [] },
  };
}

/** Assemble the hiring boost payload (caller's own profile; reach / profile_visits). */
export function buildHiringBoostInput(s: BoostFormState): HiringBoostInput {
  return {
    objective: s.objective === 'profile_visits' ? 'profile_visits' : 'reach',
    totalBudget: s.budget,
    days: s.days,
    spotlight: s.spotlight,
    targeting: { roles: s.roles, sectors: s.sectors, districts: s.districts, companySizes: [] },
  };
}

/**
 * Assemble the RFQ boost payload. Keyed off `rfqId`, objective narrowed to
 * `reach` / `quotes` (an RFQ has no inquiries/applications/profile_visits).
 */
export function buildRfqBoostInput(rfqId: string, s: BoostFormState): RfqBoostInput {
  return {
    rfqId,
    objective: s.objective === 'quotes' ? 'quotes' : 'reach',
    totalBudget: s.budget,
    days: s.days,
    spotlight: s.spotlight,
    targeting: { roles: s.roles, sectors: s.sectors, districts: s.districts, companySizes: [] },
  };
}

/**
 * Returns the reason submit is blocked, or null when the form is valid.
 *
 * Checks in priority order:
 * 1. budget_below_min  - budget < BOOST_MIN_BUDGET (hard floor, always checked)
 * 2. insufficient_balance - wallet is non-null AND (balance + grantBalance) < budget
 *
 * CN-ADS-4 (feed harden): the SPENDABLE total is purchased `balance` PLUS the
 * expiring `grantBalance` (plan-included / admin-granted credits), matching the
 * backend's grant-first reserve check (`grantBalance + balance >= budget`). Before
 * this, the gate read `balance` alone, so a user whose credits sat entirely in the
 * grant bucket saw a false "insufficient balance" and a disabled Launch button.
 *
 * A null wallet does NOT block - the server is the authoritative balance source.
 */
export function boostSubmitBlockReason(
  s: BoostFormState,
  wallet: WalletView | null,
): 'budget_below_min' | 'insufficient_balance' | null {
  if (s.budget < BOOST_MIN_BUDGET) return 'budget_below_min';
  if (wallet !== null && spendableCredits(wallet) < s.budget) return 'insufficient_balance';
  return null;
}

/** Total spendable credits = purchased balance + expiring grant credits
 *  (CN-ADS-4). Shared so the submit gate and the displayed figure never
 *  disagree. `grantBalance` is optional on the wire; missing counts as 0. */
export function spendableCredits(wallet: WalletView): number {
  return wallet.balance + (wallet.grantBalance ?? 0);
}

/**
 * Parse a raw string from the custom budget input field.
 *
 * Rules:
 *   - Empty / whitespace-only  -> { value: null, error: 'empty' }
 *   - Non-numeric / NaN / negative -> { value: null, error: 'not_a_number' }
 *   - A number < BOOST_MIN_BUDGET   -> { value: <the rounded number>, error: 'below_min' }
 *   - A valid integer >= BOOST_MIN_BUDGET -> { value, error: null }
 *
 * Values are rounded to a whole rupee (Math.round). No paise.
 */
export function parseBudgetInput(raw: string): {
  value: number | null;
  error: 'empty' | 'not_a_number' | 'below_min' | null;
} {
  const trimmed = raw.trim();
  if (trimmed === '') return { value: null, error: 'empty' };

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return { value: null, error: 'not_a_number' };

  const rounded = Math.round(parsed);
  if (rounded < BOOST_MIN_BUDGET) return { value: rounded, error: 'below_min' };

  return { value: rounded, error: null };
}

/**
 * Parse a free-typed custom duration (in days) into a whole-day value + an error
 * tag. Mirrors parseBudgetInput: blank => `empty`, non-numeric/negative =>
 * `not_a_number`, outside [BOOST_DURATION_MIN, BOOST_DURATION_MAX] =>
 * `out_of_range`. Values are rounded to a whole day (no fractional days). The
 * accepted range matches the backend guardrail enforced in BoostService.
 */
export function parseDurationInput(raw: string): {
  value: number | null;
  error: 'empty' | 'not_a_number' | 'out_of_range' | null;
} {
  const trimmed = raw.trim();
  if (trimmed === '') return { value: null, error: 'empty' };

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return { value: null, error: 'not_a_number' };

  const rounded = Math.round(parsed);
  if (rounded < BOOST_DURATION_MIN || rounded > BOOST_DURATION_MAX) {
    return { value: rounded, error: 'out_of_range' };
  }

  return { value: rounded, error: null };
}
