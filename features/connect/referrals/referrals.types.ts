/**
 * Shared TypeScript types for the Connect Referral Program.
 *
 * What: mirrors the backend response shapes exactly so server actions and the
 *   ReferralScreen share one definition and stay in sync without runtime casting.
 *
 * Cross-module links:
 *   - ReferralSummaryView mirrors GET /connect/referrals/me (referral.controller.ts)
 *   - ReferralConfigView mirrors GET/PUT /admin/connect/referrals/config
 *     (ConnectReferralConfigView from the backend schema)
 *   - ReferralLogRow mirrors the paginated GET /admin/connect/referrals list
 *
 * Watch: if the backend schema field names change (ConnectReferralConfig /
 *   ConnectReferral), update these three interfaces in lockstep. Amounts are
 *   whole CREDITS (== whole rupees) everywhere -- no paise conversion needed.
 */

/** Status lifecycle of a single referral row.
 *  pending -> qualified (friend active) -> rewarded (credits released)
 *  OR -> rejected (cap / fraud / clawback). */
export type ReferralStatus = 'pending' | 'qualified' | 'rewarded' | 'rejected';

/** One recent referral entry returned inside ReferralSummaryView.recent. */
export interface ReferralRecentEntry {
  /** Referee's display name (joined from User). */
  name: string;
  status: ReferralStatus;
  /** ISO date string -- the row's createdAt (when they signed up with the code). */
  date: string;
}

/**
 * Response from GET /connect/referrals/me. Every number is whole credits.
 * creditsEarned = sum of referrerCreditAmount for rewarded rows.
 * creditsPending = sum of referrerCreditAmount for qualified-not-yet-rewarded rows.
 */
export interface ReferralSummaryView {
  /** The caller's shareable code; created lazily on first visit. */
  code: string;
  /** Whether the referral program is currently enabled on the platform. */
  enabled: boolean;
  /** Credits the referrer earns per qualified referral (current config snapshot). */
  referrerCredits: number;
  /** Credits the new joiner earns (current config snapshot). */
  refereeCredits: number;
  /** Total number of people who signed up with this code (any status). */
  referredCount: number;
  /** How many of those have reached `rewarded` (credits spendable). */
  rewardedCount: number;
  /** How many are in `pending` or `qualified` (credits not yet released). */
  pendingCount: number;
  /** Sum of earned credits (rewarded rows) -- spendable in the boost wallet. */
  creditsEarned: number;
  /** Sum of held credits (qualified rows) -- on hold, not yet spendable. */
  creditsPending: number;
  /** Up to 20 most-recent referrals, newest first. */
  recent: ReferralRecentEntry[];
}

/**
 * Admin read/write shape for the platform-wide referral levers.
 * Mirrors ConnectReferralConfigView from the backend schema.
 * All numeric fields are whole credits / counts; 0 means "unlimited" for caps.
 */
export interface ReferralConfigView {
  /** Master on/off for the whole program. */
  enabled: boolean;
  /** Credits the referrer earns per qualified referral. */
  referrerCredits: number;
  /** Credits the new joiner earns. */
  refereeCredits: number;
  /** Days a qualified credit is held before it becomes spendable. */
  holdbackDays: number;
  /** Max REWARDED referrals per referrer lifetime; 0 = unlimited. */
  perReferrerCap: number;
  /** Max rewarded per referrer per calendar month; 0 = unlimited. */
  monthlyPerReferrerCap: number;
  /** Max referral credits a single user can earn per financial year; 0 = unlimited. */
  annualCreditCeilingPerUser: number;
  /** Program-wide ceiling on total credits granted; 0 = unlimited. */
  totalBudgetCap: number;
  /** Max referrals attributed to one referrer per 24h; 0 = unlimited. */
  dailyVelocityPerReferrer: number;
}

/**
 * One row in the admin referral log from GET /admin/connect/referrals.
 * Field names mirror ConnectReferral schema + joined user names.
 */
export interface ReferralLogRow {
  /** Referral document _id. */
  id: string;
  /** Referrer's display name (joined). */
  referrerName: string;
  /** Referee's display name (joined). */
  refereeName: string;
  status: ReferralStatus;
  rejectionReason?: string;
  /** Credits snapshotted at qualify time for the referrer side. */
  referrerCreditAmount: number;
  /** Credits snapshotted at qualify time for the referee side. */
  refereeCreditAmount: number;
  /** ISO date string -- row createdAt. */
  date: string;
  /** ISO date string -- when it became qualified; null if still pending. */
  qualifiedAt?: string;
  /** ISO date string -- when credits were released; null if not yet rewarded. */
  rewardedAt?: string;
}

/** Paginated admin list response. */
export interface ReferralLogPage {
  items: ReferralLogRow[];
  total: number;
}
