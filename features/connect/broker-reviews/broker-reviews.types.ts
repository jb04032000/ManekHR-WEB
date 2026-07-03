/**
 * ManekHR Connect - Broker Reviews types (verified-but-anonymous broker reviews,
 * Slice 3w). Mirrors the backend `BrokerReviewService` public shapes exactly
 * (see crewroster-backend/src/modules/connect/broker-reviews/broker-review.service.ts).
 *
 * A broker review is anchored to a CONFIRMED introduction both sides agreed to,
 * so every card is "verified". Cards are anonymized by default: an anonymous
 * card NEVER carries a reviewer id/name, only initials + role (+ city when the
 * (role, city) tuple is not unique). A `named` card shows the reviewer's name.
 *
 * Cross-module: consumed by components/connect/BrokerReviews.tsx (visitor
 * display) + the broker section in features/connect/profile/ProfileView.tsx; the
 * write inputs (upsert/reply/withdraw) are consumed by Slice 3wB's review form
 * on a confirmed introduction. Keep in sync with the BE service return shape.
 */

/** The buyer/seller role the reviewer held in the anchoring introduction. */
export type BrokerReviewerRole = 'buyer' | 'seller';

/** Reviewer visibility choice: hidden (default) or named opt-in. */
export type BrokerReviewVisibility = 'anonymous' | 'named';

/**
 * One anonymized (or named) review card on the public broker profile. NEVER
 * carries `reviewerUserId`. `name` is present ONLY for a `named` review; for an
 * anonymous review `initials` (+ `role` + optional `city`) describe the reviewer
 * without identifying them. `city` is dropped under thin-market coarsening.
 */
export interface PublicBrokerReviewCard {
  _id: string;
  rating: number;
  text?: string;
  /** Always true - every broker review is anchored to a confirmed introduction. */
  verifiedIntroduction: true;
  role: BrokerReviewerRole;
  /** Present only when the reviewer opted in to a `named` review. */
  name?: string;
  /** Present only for anonymous cards (initials of the reviewer's name, e.g. "R.P."). */
  initials?: string;
  /** Present only for anonymous cards; dropped when the (role, city) tuple is unique. */
  city?: string;
  brokerReply?: { text: string; repliedAt: string } | null;
  createdAt?: string;
}

/** The proof-led aggregate + anonymized cards a profile visitor sees. */
export interface PublicBrokerProfile {
  aggregate: {
    /** Live count of the broker's CONFIRMED, non-deleted introductions. */
    introductionsConfirmed: number;
    /** Distinct participant count across those confirmed introductions. */
    distinctPeople: number;
    ratingCount: number;
    ratingAvg: number;
    /** Every review is anchored to a confirmed introduction, so this is 100. */
    verifiedReviewRatio: number;
  };
  reviews: PublicBrokerReviewCard[];
}

/** Create / edit payload for the caller's review of a broker (Slice 3wB write). */
export interface UpsertBrokerReviewInput {
  /** The confirmed introduction this review is anchored to (the trust anchor). */
  introductionId: string;
  rating: number;
  text?: string;
  /** Defaults to `anonymous` BE-side when omitted. */
  visibility?: BrokerReviewVisibility;
}

/**
 * The caller's own review of a broker for one introduction (drives the edit
 * form), or null when they have not reviewed yet. Mirrors the BE review doc's
 * own-read projection.
 */
export interface MyBrokerReview {
  _id: string;
  introductionId: string;
  brokerUserId: string;
  rating: number;
  text?: string;
  visibility: BrokerReviewVisibility;
  brokerReply?: { text: string; repliedAt: string } | null;
  createdAt?: string;
  updatedAt?: string;
}
