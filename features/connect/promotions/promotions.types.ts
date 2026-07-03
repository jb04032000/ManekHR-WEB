/**
 * Connect promotions / sales admin types (M3.2).
 *
 * Mirrors the backend `ConnectCreditDrop` schema + `CreateCreditDropDto`. Plan
 * discounts / intro offers / scheduled sale windows reuse the coupon types in
 * `@/types`, so they are not redefined here.
 */

export type CreditDropTargetMode = 'subscribers' | 'users';

/** A past credit-drop campaign (the admin history row). */
export interface CreditDrop {
  _id: string;
  amountPerUser: number;
  note: string;
  expiresAt: string | null;
  targetMode: CreditDropTargetMode;
  planId: string | null;
  targetUserIds: string[];
  recipientCount: number;
  totalCreditsGranted: number;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Payload for running a new credit drop. */
export interface CreateCreditDropInput {
  amountPerUser: number;
  note: string;
  /** ISO-8601; omit for credits that never expire. */
  expiresAt?: string;
  targetMode: CreditDropTargetMode;
  /** `subscribers` mode only: narrow to a single plan. */
  planId?: string;
  /** `users` mode only: the explicit recipients. */
  userIds?: string[];
}
