/** Connect Request-for-Quote types (W4; board redesigned 2026-06-10 to the
 *  Jobs-board bar). Mirrors the BE rfq/quote schemas + RfqService payloads
 *  (crewroster-backend src/modules/connect/rfq). Keep both sides in sync. */

import type { ListingCategory, ListingUnit } from '../search.types';

export type RfqStatus = 'open' | 'closed' | 'awarded';
export type QuoteStatus = 'sent' | 'shortlisted' | 'accepted' | 'declined' | 'withdrawn';

export interface RfqLocation {
  district: string;
  city: string;
  state: string;
}

export interface Rfq {
  _id: string;
  buyerUserId: string;
  title: string;
  description: string;
  /** A known LISTING_CATEGORIES slug OR a custom term (folded into the shared
   *  ConnectTag pool by the BE; render via categoryLabel for an unknown one). */
  category: string;
  quantity: number | null;
  unit: ListingUnit | null;
  budgetMin: number | null;
  budgetMax: number | null;
  neededBy: string | null;
  location: RfqLocation;
  status: RfqStatus;
  quotesCount: number;
  /** Denormalized lowest LIVE quote price -- the card's "low ₹X" signal. */
  lowestQuotePrice?: number | null;
  /** True for a seeded sample request (denormalized from the buyer's User.isDemo).
   *  Drives the SampleBadge on the RFQ card/detail + the demo down-rank. Optional;
   *  absent = real request. Keep `isDemo` in sync with the BE Rfq schema + mirrors. */
  isDemo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Quote {
  _id: string;
  rfqId: string;
  sellerUserId: string;
  storefrontId: string | null;
  /** The quoted TOTAL in rupees (what the buyer compares; "low ₹X" reads this). */
  price: number;
  /** Optional per-unit breakdown behind the total: rate x rateQuantity = price. */
  rate?: number | null;
  rateQuantity?: number | null;
  /** What the rate includes -- preset slugs or short custom strings. */
  includes?: string[];
  /** Offer validity in days from the last update; null = till the request closes. */
  validityDays?: number | null;
  /** Work-sample photo URLs (max 5). */
  sampleUrls?: string[];
  leadTimeDays: number | null;
  message: string;
  status: QuoteStatus;
  /** True for a seeded sample quote (denormalized from the seller's User.isDemo).
   *  Drives the SampleBadge on a quote row. Optional; absent = real quote. Keep
   *  `isDemo` in sync with the BE Quote schema + every Connect mirror. */
  isDemo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Preset "what's included" slugs the composer offers (QuoteCard maps them back
 *  to localized labels; unknown strings render humanized). Mirror BE comment in
 *  quote.schema.ts `includes`. */
export const QUOTE_INCLUDE_PRESETS = [
  'approval-sample',
  'gst-included',
  'pickup-delivery',
  'packing',
  'materials',
] as const;

/** The detail read (GET /connect/rfq/:id): the request plus two additive
 *  context blocks -- the buyer's real track record and the anonymized spread of
 *  live quote totals (never who quoted what). Mirrors BE RfqService.getRfq. */
export interface RfqDetail extends Rfq {
  buyerStats: { rfqsPosted: number; rfqsAwarded: number };
  quoteStats: { count: number; low: number | null; high: number | null };
}

/** A seller's own quote enriched with a small RFQ snapshot (BE listMyQuotes)
 *  so the "My quotes" tab shows what each quote was FOR without extra fetches. */
export interface MyQuoteView extends Quote {
  rfq: {
    id: string;
    title: string;
    /** Known slug or custom term (see Rfq.category). */
    category: string;
    status: RfqStatus;
    quotesCount: number;
    lowestQuotePrice: number | null;
    neededBy: string | null;
    location: Partial<RfqLocation> | null;
  } | null;
}

export interface CreateRfqPayload {
  title: string;
  description?: string;
  /** Known slug or a custom term; the BE folds it into the shared tag pool. */
  category: string;
  quantity?: number;
  unit?: ListingUnit;
  budgetMin?: number;
  budgetMax?: number;
  neededBy?: string;
  location?: Partial<RfqLocation>;
}

export interface CreateQuotePayload {
  price: number;
  rate?: number;
  rateQuantity?: number;
  includes?: string[];
  validityDays?: number;
  sampleUrls?: string[];
  leadTimeDays?: number;
  message?: string;
  storefrontId?: string;
}

/** Derived status buckets the rail's Status checklist filters by. open and
 *  closing-soon are both status='open' on the BE; the bucket is derived from
 *  neededBy (within 3 days = closing-soon). Keep in sync with the BE helper. */
export type RfqStatusBucket = 'open' | 'closing-soon' | 'awarded';

/**
 * Board filter-rail + sort + search + paging params. Arrays serialize to csv on
 * the wire (rfq.actions toBoardParams); keep key names in sync with the URL
 * parser in app/connect/rfq/page.tsx + useRfqBoardFilters.filtersToSearch.
 */
export interface BoardFilters {
  category?: ListingCategory;
  /** Rail multi-select districts (csv on the wire; supersedes `district`). */
  districts?: string[];
  district?: string;
  /** Status bucket checklist (csv on the wire). Empty = open only. */
  statuses?: RfqStatusBucket[];
  budgetMin?: number;
  budgetMax?: number;
  /** With a budget filter: also include "Negotiable" (no-budget) requests. */
  includeNegotiable?: boolean;
  /** Viewer scope: only categories the viewer supplies (active listings). */
  matchedToMyWork?: boolean;
  /** Viewer scope: only requests the viewer has NO live quote on. */
  notQuotedByMe?: boolean;
  postedWithinDays?: number;
  includeClosed?: boolean;
  sort?: 'recent' | 'budget' | 'closing';
  limit?: number;
  skip?: number;
  q?: string;
}

/** One countable facet value (district "Varachha" -> 7 open requests). */
export interface FacetEntry {
  value: string;
  count: number;
}

/** Counts payload for the rail (GET board/facets). Mirrors BE RfqBoardFacets. */
export interface BoardFacets {
  total: number;
  category: FacetEntry[];
  district: FacetEntry[];
  status: { open: number; closingSoon: number; awarded: number };
  matchedToMyWork: number;
  notQuotedByMe: number;
}

/** Headline counts for the board KPI strip. Mirrors BE RfqBoardStats. */
export interface BoardStats {
  openTotal: number;
  newToday: number;
  matchesMyWork: number;
  /** The viewer's active listing categories -- drives the "Matches your work"
   *  ribbon + the rail toggle visibility (empty = viewer supplies nothing). */
  supplyCategories: string[];
  myOpenRequests: number;
  quotesOnMyOpen: number;
  myQuotesTotal: number;
  myQuotesShortlisted: number;
  myQuotesWon: number;
}

export const EMPTY_BOARD_STATS: BoardStats = {
  openTotal: 0,
  newToday: 0,
  matchesMyWork: 0,
  supplyCategories: [],
  myOpenRequests: 0,
  quotesOnMyOpen: 0,
  myQuotesTotal: 0,
  myQuotesShortlisted: 0,
  myQuotesWon: 0,
};
