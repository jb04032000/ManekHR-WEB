/**
 * ManekHR Connect - Broker Introductions types (anti-gaming core, Slice 2).
 *
 * Mirrors the backend `IntroductionService` shapes exactly. A broker introduces
 * TWO people (a buyer + a seller); the introduction stays `pending` until BOTH
 * introduced parties independently confirm, then `confirmed`. A declined row is
 * soft-deleted server-side.
 *
 * Storage is a CANONICAL ORDERED pair (`userLow` = the lexicographically-smaller
 * User id, `userHigh` the larger; `roleOfLow` pins the buyer/seller side to the
 * low party). The web NEVER computes that ordering - it sends `partyAUserId` /
 * `partyBUserId` + `roleOfA`, and the backend derives `roleOfLow`. On the read
 * side the web reads the populated `userLow` / `userHigh` / `brokerUserId`.
 *
 * Cross-module links:
 *  - broker gate reads ConnectProfile.isBroker (features/connect/profile.types).
 *  - the two people-pickers come from network.actions `listConnections` +
 *    `getPeople` (the broker introduces two of their own connections).
 *  - keep the field names in lockstep with the BE introduction.schema.ts.
 */

/** The two roles an introduced party can hold. Mirrors BE `IntroductionRole`. */
export type IntroductionRole = 'buyer' | 'seller';

/** Lifecycle of an introduction. Mirrors BE `IntroductionStatus`. */
export type IntroductionStatus = 'pending' | 'confirmed' | 'declined';

/**
 * A populated party identity on an introduction read. Mongoose populates
 * `name profilePicture handle` onto `brokerUserId` / `userLow` / `userHigh`, so
 * the populated value is this object. On the create/confirm/decline write
 * responses the same fields come back as bare id STRINGS (not populated) - hence
 * the `| string` union, and the `partySummary` helper that normalizes both.
 */
export interface IntroductionParty {
  _id: string;
  name?: string;
  profilePicture?: string;
  handle?: string | null;
}

/**
 * One introduction row as returned by the backend (the lean Mongo doc). Read
 * endpoints (`/pending`, `/mine`) populate the three party refs; the write
 * endpoints return them as id strings. The `confirmedBy*At` timestamps let the
 * UI tell which side(s) have already confirmed.
 */
export interface Introduction {
  _id: string;
  brokerUserId: IntroductionParty | string;
  userLow: IntroductionParty | string;
  userHigh: IntroductionParty | string;
  /** The low party's role; the high party holds the opposite. */
  roleOfLow: IntroductionRole;
  note?: string;
  status: IntroductionStatus;
  /** ISO date string, or null until the low party confirms their side. */
  confirmedByLowAt?: string | null;
  /** ISO date string, or null until the high party confirms their side. */
  confirmedByHighAt?: string | null;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Create payload - the broker is the caller (never a body field). */
export interface CreateIntroductionInput {
  partyAUserId: string;
  partyBUserId: string;
  /** partyA's role; the BE derives the canonical `roleOfLow` from the pair order. */
  roleOfA: IntroductionRole;
  note?: string;
}

/**
 * One introduction the caller RECEIVED (they are a party, never only the broker).
 * Mirrors `IntroductionService.listReceivedForUser` exactly: a normal populated
 * introduction row ENRICHED with the caller's own role + the broker id, so the
 * web can open a broker review without re-deriving the canonical pair client-side.
 *
 * Cross-module: powers the "Introductions you received" section in
 * IntroductionsList -> BrokerReviewModal (broker-reviews module, the review write
 * surface). `brokerId` is the canonical User id the review is anchored to.
 */
export interface ReceivedIntroduction extends Introduction {
  /** The caller's own buyer/seller side in this introduction (BE-derived). */
  myRole: IntroductionRole;
  /** The broker's User id (resolved off the populated ref BE-side). */
  brokerId: string;
}
