/**
 * ManekHR Connect Marketplace - web types (Phase M1).
 *
 * Mirrors the backend Listing schema (src/modules/connect/marketplace/schemas/
 * listing.schema.ts). Person-centric: a listing belongs to a Connect User
 * (`ownerUserId`), never a workspace.
 */

import type { RatingAggregate } from '../reviews/reviews.types';
// Typed plan-limit detail carried on a blocked create (shared across all four
// Connect create flows). See features/connect/connect-limit.ts.
import type { ConnectLimitInfo } from '../connect-limit';

export type ListingCategory =
  | 'weaving'
  | 'dyeing'
  | 'printing'
  | 'embroidery-zari'
  | 'job-work'
  | 'raw-material'
  | 'machinery'
  | 'finished-goods'
  // Service listing slugs (Slice B2). Mirror of the backend NEW_SERVICE_CATEGORIES
  // (listing.schema.ts) - the 8 categories that carry + require serviceDetails.
  // Additive, like `course`; the form switches to the service field set for these.
  | 'consulting'
  | 'maintenance'
  | 'machine-repair'
  | 'testing'
  | 'installation'
  | 'transport'
  | 'logistics'
  | 'contractor';

/**
 * The 8 NEW service-listing categories (Slice B2). Mirror of the backend
 * `NEW_SERVICE_CATEGORIES`: these are the ONLY categories that require
 * `serviceDetails` (deliveryMode + pricingModel) at the DTO layer, so the create
 * form switches to the service field set + the publish gate requires those two
 * for them - exactly how `course` requires its course fields. Keep in sync with
 * listing.schema.ts.
 */
export const NEW_SERVICE_CATEGORIES = [
  'consulting',
  'maintenance',
  'machine-repair',
  'testing',
  'installation',
  'transport',
  'logistics',
  'contractor',
] as const;
export type NewServiceCategory = (typeof NEW_SERVICE_CATEGORIES)[number];

/**
 * The full service-listing classification set (Slice B2). Mirror of the backend
 * `SERVICE_CATEGORIES`: the 8 NEW_SERVICE_CATEGORIES PLUS the pre-existing
 * service-ish trade categories. This is the broader "is this listing a service?"
 * set the public detail page uses to emit Service JSON-LD (the schema swap mirrors
 * how `course` swaps to Course). It does NOT drive the form's require-rule - only
 * NEW_SERVICE_CATEGORIES does. Keep in sync with listing.schema.ts.
 */
export const SERVICE_CATEGORIES = [
  ...NEW_SERVICE_CATEGORIES,
  'job-work',
  'dyeing',
  'printing',
  'embroidery-zari',
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

/** Service delivery modes - mirror of the backend `LISTING_SERVICE_DELIVERY_MODES`. */
export const LISTING_SERVICE_DELIVERY_MODES = ['on-site', 'remote', 'both'] as const;
export type ListingServiceDeliveryMode = (typeof LISTING_SERVICE_DELIVERY_MODES)[number];

/** Service pricing models - mirror of the backend `LISTING_SERVICE_PRICING_MODELS`.
 *  Drives the shared price rows (negotiable -> no price; the rest -> a rate in
 *  priceMin), exactly like the course fee type drives them. */
export const LISTING_SERVICE_PRICING_MODELS = [
  'fixed',
  'hourly',
  'daily',
  'per-visit',
  'negotiable',
] as const;
export type ListingServicePricingModel = (typeof LISTING_SERVICE_PRICING_MODELS)[number];

export type ListingPriceType = 'fixed' | 'range' | 'negotiable';

export type ListingStatus =
  | 'draft'
  | 'pending_review'
  | 'active'
  | 'paused'
  | 'rejected'
  | 'expired';

export type ListingModerationStatus = 'pending' | 'approved' | 'rejected';

export interface ListingLocation {
  district?: string;
  city?: string;
  state?: string;
}

/** One seller-entered specification row (label/value) - the detail-page spec
 *  grid. Mirrors the backend `ListingSpec` sub-schema (max 12 rows). */
export interface ListingSpec {
  label: string;
  value: string;
}

/** Seller-entered off-platform trade terms (dispatch / payment / returns) for
 *  the detail-page rail. Mirrors the backend `ListingTradeTerms`; all optional
 *  prose - the platform never processes payment (mediator model). */
export interface ListingTradeTerms {
  dispatch?: string;
  payment?: string;
  returns?: string;
}

/**
 * One product video on a listing. Mirrors the backend `ListingVideo` sub-schema
 * (and the feed video media shape): `url` is the clip, `posterUrl` an optional
 * client-captured still (poster-first render), `durationSec` the server-derived
 * length. The listing carries at most one (the form + backend cap it at one).
 */
export interface ListingVideo {
  url: string;
  posterUrl?: string;
  durationSec?: number;
}

export interface AdminListing {
  _id: string;
  ownerUserId: string;
  /** The storefront this product belongs to (the owner's shop). */
  storefrontId?: string;
  title: string;
  description?: string;
  category: string;
  priceType: ListingPriceType;
  priceMin?: number | null;
  priceMax?: number | null;
  unit?: string;
  moq?: number | null;
  leadTimeDays?: number | null;
  location?: ListingLocation;
  images?: string[];
  /** Product video(s) - at most one (edit prefill + manage views). */
  videos?: ListingVideo[];
  tags?: string[];
  /** Seller-entered spec rows (detail-page spec grid). */
  specs?: ListingSpec[];
  /** Seller-entered trade terms (detail-page rail). */
  tradeTerms?: ListingTradeTerms;
  /** Course detail (Institutes Phase 1) - only on a `course`-category listing. */
  courseDetails?: ListingCourseDetails;
  /** Service detail (Slice B2) - only on a service-category listing. */
  serviceDetails?: ListingServiceDetails;
  /** Shop Collection ids this product belongs to (owner view). */
  collectionIds?: string[];
  status: ListingStatus;
  moderationStatus: ListingModerationStatus;
  rejectionReason?: string | null;
  /** True for a seeded sample listing (denormalized from the owner's User.isDemo).
   *  Drives the SampleBadge + the marketplace down-rank. Optional; absent = real.
   *  Keep `isDemo` in sync with the BE Listing schema + every Connect mirror. */
  isDemo?: boolean;
  createdAt?: string;
}

/**
 * Course-listing detail (Institutes Phase 1). Present ONLY on a `course`-category
 * listing; mirrors the backend `Listing.courseDetails` sub-schema. The fee is not
 * a separate amount: a course reuses the listing `priceMin`/`priceMax`/`priceType`
 * rows, driven by `feeType` (free -> no price; fixed -> priceMin; range ->
 * priceMin/priceMax). Cross-module: course listings surface in the marketplace
 * grid + detail (ListingGridCard / ListingDetailScreen) with an "Enquire to enrol"
 * CTA instead of "Contact seller". Keep in sync with the BE course DTO.
 */
export interface ListingCourseDetails {
  durationLabel: string;
  batchStart?: string | null;
  mode: 'online' | 'offline' | 'hybrid';
  feeType: 'fixed' | 'range' | 'free';
  seats?: number | null;
  certificate: boolean;
  skillsTaught: string[];
}

/** Course delivery modes - mirror of the backend course `mode` enum. */
export const LISTING_COURSE_MODES = ['online', 'offline', 'hybrid'] as const;

/** Course fee types - mirror of the backend course `feeType` enum. The fee then
 *  drives the shared price rows (free -> none, fixed -> priceMin, range -> both). */
export const LISTING_COURSE_FEE_TYPES = ['fixed', 'range', 'free'] as const;

/**
 * Service-listing detail (Slice B2). Present ONLY on a service-category listing;
 * mirrors the backend `Listing.serviceDetails` sub-schema. The fee is not a
 * separate amount: a service reuses the listing `priceMin`/`priceMax`/`priceType`
 * rows, driven by `pricingModel` (negotiable -> no price; fixed/hourly/daily/
 * per-visit -> a rate in priceMin) - exactly how `courseDetails` reuses them.
 * Cross-module: service listings render the "Service details" block on
 * ListingDetailScreen and emit Service JSON-LD (connect-schema.ts). Keep in sync
 * with the BE service DTO.
 */
export interface ListingServiceDetails {
  deliveryMode: ListingServiceDeliveryMode;
  pricingModel: ListingServicePricingModel;
  coverageArea?: string;
  yearsExperience?: number | null;
  availability?: string;
}

/** Pricing / order unit - mirror of the backend `LISTING_UNITS` enum. */
export type ListingUnit =
  | 'per-meter'
  | 'per-piece'
  | 'per-kg'
  | 'per-set'
  | 'per-dozen'
  | 'per-order';

/**
 * A public listing detail, as returned by `GET /connect/marketplace/public/
 * listings/:id` (M1.2 `ListingService.getPublic`). The endpoint only ever
 * returns an `active` + `approved` listing, so the seller-facing lifecycle
 * fields are not part of the buyer-facing contract here.
 */
export interface ListingDetail {
  _id: string;
  ownerUserId: string;
  title: string;
  description: string;
  category: string;
  priceType: ListingPriceType;
  priceMin?: number | null;
  priceMax?: number | null;
  unit?: ListingUnit | null;
  moq?: number | null;
  leadTimeDays?: number | null;
  location?: ListingLocation;
  images: string[];
  /** Product video(s) - at most one. Rendered poster-first on the detail page. */
  videos?: ListingVideo[];
  tags?: string[];
  /** Seller-entered spec rows - the detail-page Specifications grid. */
  specs?: ListingSpec[];
  /** Seller-entered trade terms - the detail-page Trade terms rail card. */
  tradeTerms?: ListingTradeTerms;
  /** Course detail (Institutes Phase 1) - present only on a `course` listing;
   *  drives the detail-page course card + "Enquire to enrol" CTA. */
  courseDetails?: ListingCourseDetails;
  /** Service detail (Slice B2) - present only on a service-category listing;
   *  drives the detail-page "Service details" block + the Service JSON-LD. */
  serviceDetails?: ListingServiceDetails;
  /** Seller trust marker (M2.3) - drives the "Verified" badge on the detail page. */
  verified: boolean;
  /** The owning shop (name + slug), for the breadcrumb + "View storefront" link. */
  storefront?: { id: string; name: string; slug: string } | null;
  /** Seller rating aggregate (R2) - present only when the seller is rated. */
  rating?: RatingAggregate;
  /** The seller's join date (ISO) - the honest "On ManekHR since" seller-card
   *  stat. Attached by the backend `getPublic`; absent for legacy reads. */
  sellerMemberSince?: string | null;
  /** True for a seeded sample listing (denormalized from the owner's User.isDemo).
   *  Drives the SampleBadge on the detail page. Optional; absent = real listing.
   *  Keep `isDemo` in sync with the BE Listing schema + every Connect mirror. */
  isDemo?: boolean;
  /** ISO date string. */
  createdAt?: string;
}

/** Seller-facing inquiry lifecycle - mirror of the backend `INQUIRY_STATUSES`. */
export type InquiryStatus = 'sent' | 'viewed' | 'replied' | 'archived';

/**
 * One inquiry row, as returned by `POST /connect/marketplace/listings/:id/
 * inquiries` (M1.5). The mediator model means this is purely a lead signal:
 * no chat, no payment. The buyer + seller are resolved server-side.
 */
export interface Inquiry {
  _id: string;
  listingId: string;
  buyerUserId: string;
  sellerUserId: string;
  message: string;
  status: InquiryStatus;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Discriminated failure codes the inquiry modal branches on. The first two are
 * app-level codes the backend promotes to the response top level (the
 * `HttpExceptionFilter` `extra` spread); the rest are derived from the HTTP
 * status. The modal maps each to localized copy without parsing free text.
 */
export type InquiryErrorCode =
  | 'CONNECT_SELF_INQUIRY_NOT_ALLOWED'
  | 'CONNECT_SELLER_LEAD_CAP_REACHED'
  | 'LISTING_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'UNKNOWN';

/**
 * Result of the `sendInquiry` server action. Carries the discriminated
 * `code` on failure so the modal renders the right localized message; the
 * raw backend `error` string is kept as a fallback for the `UNKNOWN` case.
 */
export type SendInquiryResult =
  | { ok: true; data: Inquiry }
  | { ok: false; code: InquiryErrorCode; error: string };

/** Listing price-type options - mirror of the backend `LISTING_PRICE_TYPES`. */
export const LISTING_PRICE_TYPES = ['fixed', 'range', 'negotiable'] as const;

/** Listing unit options - mirror of the backend `LISTING_UNITS`. */
export const LISTING_UNITS = [
  'per-meter',
  'per-piece',
  'per-kg',
  'per-set',
  'per-dozen',
  'per-order',
] as const;

/**
 * Create-listing payload (M1.6.3). Mirrors the backend `CreateListingDto`:
 * `title` + `category` are required, everything else optional. `ownerUserId`
 * is never sent - the backend derives it from the JWT.
 */
export interface CreateListingInput {
  title: string;
  description?: string;
  category: string;
  priceType?: ListingPriceType;
  priceMin?: number;
  priceMax?: number;
  unit?: ListingUnit;
  moq?: number;
  leadTimeDays?: number;
  location?: ListingLocation;
  images?: string[];
  /**
   * Product video(s), at most one (mirrors the DTO `@ArrayMaxSize(1)`). Only
   * `url` + optional `posterUrl` are sent; the backend derives `durationSec` and
   * ownership-checks both URLs.
   */
  videos?: Pick<ListingVideo, 'url' | 'posterUrl'>[];
  /** Raw seller-entered terms; the backend resolves them to canonical slugs. */
  tags?: string[];
  /** Spec rows for the detail-page spec grid (max 12, mirrors the DTO). */
  specs?: ListingSpec[];
  /** Off-platform trade terms shown on the detail-page rail. */
  tradeTerms?: ListingTradeTerms;
  /**
   * Course detail (Institutes Phase 1), sent ONLY when `category === 'course'`.
   * The form derives `priceType`/`priceMin`/`priceMax` from `courseDetails.feeType`,
   * so the fee stays on the shared price fields (no duplicate amount).
   */
  courseDetails?: ListingCourseDetails;
  /**
   * Service detail (Slice B2), sent ONLY for a service category. The form derives
   * `priceType`/`priceMin` from `serviceDetails.pricingModel`, so the fee stays on
   * the shared price fields (no duplicate amount) - mirrors `courseDetails`.
   */
  serviceDetails?: ListingServiceDetails;
  /**
   * OPTIONAL storefront to file this product under. Omit to let the backend
   * resolve / create the seller's default shop (single-shop sellers never pick).
   */
  storefrontId?: string;
  /** Save off-market as a `draft` instead of going live on create. */
  asDraft?: boolean;
}

/**
 * Failure codes for `createListing`. `CONNECT_LIMIT_REACHED` is the per-person
 * listing cap (ConnectAllowanceService); the form turns it into the shared
 * LimitReachedDialog upgrade prompt rather than a hard error.
 */
export type CreateListingErrorCode = 'CONNECT_LIMIT_REACHED' | 'UNKNOWN';

/**
 * Result of the `createListing` action. On the cap error it carries the typed
 * `limitReached` detail ({ kind, limit, used }) so the prompt can name it - the
 * same shape every other Connect create action returns. See connect-limit.ts.
 */
export type CreateListingResult =
  | { ok: true; data: ListingDetail }
  | { ok: false; code: CreateListingErrorCode; error: string; limitReached?: ConnectLimitInfo };

/** Patch payload for `updateListing` (M1.6.4). Every field optional (mirrors `UpdateListingDto`). */
export type UpdateListingInput = Partial<CreateListingInput>;

/**
 * The seller's own listing, as returned by `GET /connect/marketplace/listings/
 * mine` (any status). Same shape as the moderation `AdminListing` - it carries
 * the lifecycle `status`, `moderationStatus`, and `rejectionReason` the manage
 * view needs.
 */
export interface OwnerListing extends AdminListing {
  /**
   * Over-limit (hide_newest grandfathering): true when this product is currently
   * hidden from PUBLIC view because the owner is over their plan limit. Display-
   * only - the owner still sees + edits it; nothing is deleted. Always false /
   * absent under the default freeze policy. Set by backend ListingService.listMine
   * from ConnectOverLimitService.
   */
  suppressed?: boolean;
}

/**
 * The other party on an inquiry row (the seller for the Sent tab, the buyer for
 * the Received tab). `null` when that user no longer exists. Mirrors the backend
 * `InquiryParty`.
 */
export interface InquiryParty {
  userId: string;
  name: string;
  avatar: string | null;
  handle: string | null;
}

/** Compact listing summary on an inquiry row; `null` if the listing was deleted. */
export interface InquiryListingSummary {
  listingId: string;
  title: string;
  coverImage: string | null;
  status: ListingStatus;
}

/**
 * A hydrated inquiry row (M1.6.5), as returned by the
 * `connect/marketplace/inquiries/mine/{sent,received}` endpoints. The raw
 * `Inquiry` carries only IDs; the backend joins the listing summary + the other
 * party's public identity so the inbox / outbox renders without N+1 fetches.
 */
export interface InquiryListItem {
  _id: string;
  listingId: string;
  buyerUserId: string;
  sellerUserId: string;
  message: string;
  status: InquiryStatus;
  createdAt: string;
  updatedAt: string;
  listing: InquiryListingSummary | null;
  party: InquiryParty | null;
  /** The inbox thread this inquiry seeded, so a row deep-links to chat. */
  threadId: string | null;
}

/**
 * One keyset page of inquiry rows (buyer outbox / seller inbox). Mirrors the
 * backend `InquiryService` envelope so the inbox never pulls an unbounded list;
 * `nextCursor` drives the "Load more" button (null when caught up).
 */
export interface InquiryListPage {
  items: InquiryListItem[];
  nextCursor: string | null;
}

/**
 * A single tag suggestion returned by `GET /connect/tags/search`. Used by the
 * listing-form tag combobox. `label` is resolved from the backend `label` field
 * (if present), then `labels.en`, then falls back to the raw `slug`.
 */
export interface TagSuggestion {
  slug: string;
  label: string;
}
