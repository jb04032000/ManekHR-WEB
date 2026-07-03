/**
 * ManekHR Connect - Reviews & Ratings types (marketplace Phase C, R3).
 *
 * Mirrors the backend `ReviewService` shapes. Reviews are person-centric: a
 * buyer rates a seller (`subjectUserId`), one editable review per pair, open to
 * any signed-in member in v1. The denormalized `RatingAggregate` is surfaced on
 * the profile / company page / marketplace card reads (R2).
 */

/** The public-facing rating roll-up for a seller (zeros / absent when unrated). */
export interface RatingAggregate {
  ratingAvg: number;
  ratingCount: number;
}

/** The reviewer's viewer-facing identity, populated on the public list. */
export interface ReviewAuthor {
  _id: string;
  name?: string;
  profilePicture?: string;
  handle?: string | null;
}

/** One review in the public seller list (reviewer identity populated). */
export interface ConnectReview {
  _id: string;
  reviewerUserId: ReviewAuthor | string;
  rating: number;
  text: string;
  verifiedPurchase: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Review counts per star (1-5) - drives the detail-page score bars. */
export type RatingDistribution = Record<'1' | '2' | '3' | '4' | '5', number>;

/** A page of a seller's reviews + their aggregate (public read). */
export interface SellerReviewsPage {
  reviews: ConnectReview[];
  aggregate: RatingAggregate;
  nextCursor: string | null;
  /** Star breakdown - present on the FIRST page only (backend computes it once;
   *  the client keeps it across cursor pages). */
  distribution?: RatingDistribution;
}

/** The caller's own review of a seller - drives the edit form (or null). */
export interface MyReview {
  _id: string;
  subjectUserId: string;
  rating: number;
  text: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Create / edit payload for the caller's review of a seller. */
export interface UpsertReviewInput {
  subjectUserId: string;
  rating: number;
  text?: string;
}
