/**
 * Web types for the Connect usage roll-up (GET /me/connect/usage). Mirrors the
 * backend ConnectUsageRow: per-person used-vs-limit for the four count caps plus
 * storage. `limit === -1` means unlimited. Same `kind` vocabulary as the limit
 * 403, extended with `storage`. See backend connect-usage.service.ts.
 */
import type { ConnectLimitKind } from '@/lib/analytics-events';

/** Usage covers the four count kinds plus the (separately enforced) storage cap. */
export type ConnectUsageKind = ConnectLimitKind | 'storage';

/** Over-limit (grandfathering) policy for a kind. Mirrors the backend. */
export type ConnectOverLimitPolicy = 'freeze' | 'hide_newest';

export interface ConnectUsageRow {
  kind: ConnectUsageKind;
  used: number;
  limit: number;
  /** used > limit (and limit !== -1). */
  overLimit: boolean;
  /** What happens while over limit: freeze = block new; hide_newest = hide excess. */
  policy: ConnectOverLimitPolicy;
  /** Grace days before hide_newest suppresses anything. */
  graceDays: number;
  /** ISO start of the current over-limit episode, or null. */
  overLimitSince: string | null;
  /** ISO deadline (overLimitSince + graceDays) after which hide_newest suppresses, or null. */
  graceEndsAt: string | null;
  /** hide_newest + over limit + grace elapsed → the newest excess is hidden from public now. */
  suppressionActive: boolean;
  /** How many items are suppressed right now (0 under freeze / within grace / storage). */
  suppressedCount: number;
}
