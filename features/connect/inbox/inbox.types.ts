/**
 * ManekHR Connect -- Inbox (Phase 7) web types. Mirror the backend shapes
 * (`src/modules/connect/inbox/*`). Person-centric: ids are `User` ids.
 */

import type { ListingCategory, ListingPriceType } from '../search.types';
import type { JobWageType, JobStatus, ApplicationStatus } from '../jobs/jobs.types';
import type { QuoteStatus, RfqStatus } from '../rfq/rfq.types';
import type { InquiryStatus } from '../marketplace/marketplace.types';

// `candidate_request` (Institutes Phase 2, Feature 4): a business sends an
// institute a "Hire our trained candidates" lead, which seeds an inbox context
// thread on this channel. Mirror of the BE `inbox.constants` channel set + the
// `CandidateRequest` entity. The lead is conversation-only (no inline actions);
// the institute owner just replies.
export const INBOX_CHANNEL_TYPES = [
  'dm',
  'inquiry',
  'application',
  'quote',
  'candidate_request',
  'system',
] as const;
export type InboxChannelType = (typeof INBOX_CHANNEL_TYPES)[number];

/** Keyset page sizes -- must match the backend `inbox.constants.ts` tunables so
 *  "load older" knows when a page is the last one. */
export const INBOX_THREAD_PAGE_SIZE = 25;
export const INBOX_MESSAGE_PAGE_SIZE = 30;

export type InboxContextEntityType =
  | 'Inquiry'
  | 'JobApplication'
  | 'Quote'
  // Institutes Phase 2, Feature 4: the source row of a `candidate_request`
  // thread (the hire lead a business sent an institute). Mirror of the BE
  // `CandidateRequest` entity type.
  | 'CandidateRequest';
export type InboxMessageKind = 'text' | 'photo' | 'voice' | 'system';
export const INBOX_REPORT_REASONS = ['spam', 'scam', 'abusive', 'off_topic', 'other'] as const;
export type InboxReportReason = (typeof INBOX_REPORT_REASONS)[number];

/** The other party on a thread, hydrated for the list / header. */
export interface InboxParty {
  userId: string;
  name: string;
  avatar: string | null;
  handle: string | null;
  /** True for a seeded sample person (User.isDemo), surfaced by the backend inbox
   *  hydration -> drives the SampleBadge beside the party name. Optional; absent =
   *  real member. Keep `isDemo` in sync with backend `InboxParty` + every mirror. */
  isDemo?: boolean;
}

/**
 * What a context thread is ABOUT (mirror of BE `ThreadContext`), hydrated live at
 * read time from the source row. A discriminated union by `kind`:
 *  - inquiry           -> the marketplace listing (product card; links to the listing).
 *  - application       -> the Job an application is for (job card; -> /connect/jobs/[id]).
 *  - quote             -> the Rfq a quote answers (RFQ card; -> /connect/rfq/[id]).
 *  - candidate_request -> the institute a "Hire our trained candidates" lead was
 *                         sent to (institute card; -> /connect/company/[pageSlug]).
 * `null` for dm / system, or when the source entity (or its parent) was deleted
 * -> ContextCard renders the lean fallback. Keep in sync with the BE
 * `ThreadContext` union (inbox.service.ts). Consumed by ContextCard.tsx +
 * threadPreview (inbox-format.ts).
 */
/**
 * Employer-only snapshot of the applicant (mirror of BE `ApplicantSnapshot`).
 * Present on an `application` context ONLY when the viewer is the employer;
 * `null` for the applicant's own view and when the applicant has no profile.
 * Public profile facts only - never private (resume / voice / contact).
 */
export interface InboxApplicantSnapshot {
  headline: string | null;
  matchedSkills: string[];
  jobSkillCount: number;
  district: string | null;
  pastApplicant: boolean;
}

export type InboxThreadContext =
  | {
      kind: 'inquiry';
      listingId: string;
      title: string;
      coverImage: string | null;
      priceType: ListingPriceType;
      priceMin: number | null;
      priceMax: number | null;
      unit: string | null;
      moq: number | null;
      status: InquiryStatus | null;
    }
  | {
      kind: 'application';
      jobId: string;
      title: string;
      companyName: string | null;
      companyLogo: string | null;
      wageType: JobWageType | null;
      wageMin: number | null;
      wageMax: number | null;
      district: string | null;
      status: ApplicationStatus;
      viewed: boolean;
      jobStatus: JobStatus;
      /** Which inline actions the card offers + gates the applicant snapshot. */
      viewerRole: 'employer' | 'applicant';
      /** Employer-only; null for the applicant's own view. */
      applicant: InboxApplicantSnapshot | null;
    }
  | {
      kind: 'quote';
      rfqId: string;
      title: string;
      sampleImage: string | null;
      price: number | null;
      quantity: number | null;
      unit: string | null;
      budgetMin: number | null;
      budgetMax: number | null;
      district: string | null;
      status: QuoteStatus;
      rfqStatus: RfqStatus;
      /** Which inline actions the card offers (buyer accept/decline vs supplier update). */
      viewerRole: 'buyer' | 'supplier';
    }
  // candidate_request (Institutes Phase 2, Feature 4): a business's
  // "Hire our trained candidates" lead to an institute. The subject is the
  // INSTITUTE page (logo/name + deep-link to /connect/company/[pageSlug]); the
  // lead is conversation-only, so there are NO inline actions (the owner just
  // replies). Mirror of the BE hydrated `candidate_request` ThreadContext;
  // `pageSlug`/`pageLogo`/`fromUserName` are null when that fact is unavailable
  // (deleted page -> render the card without the link). Keep in sync with the BE
  // `hydrateContexts` candidate_request branch.
  | {
      kind: 'candidate_request';
      candidateRequestId: string;
      pageId: string;
      pageName: string;
      pageSlug: string | null;
      pageLogo: string | null;
      fromUserName: string | null;
      status: 'sent' | 'viewed' | 'replied' | 'archived';
      messageSnippet: string;
    };

/** A hydrated thread-list row (BE `ThreadListItem`). */
export interface InboxThread {
  _id: string;
  channelType: InboxChannelType;
  contextEntityType: InboxContextEntityType | null;
  contextEntityId: string | null;
  context: InboxThreadContext | null;
  party: InboxParty | null;
  lastMessage: {
    preview: string;
    kind: InboxMessageKind;
    senderUserId: string | null;
    seq: number;
    createdAt: string;
  } | null;
  lastActivityAt: string;
  unreadCount: number;
  archived: boolean;
  muted: boolean;
  closed: boolean;
}

/** One photo attachment on a message. */
export interface InboxMessageMedia {
  url: string;
  mime: string;
  width: number | null;
  height: number | null;
  scanStatus: 'pending' | 'clean' | 'flagged';
  /** Client-only: a local object-URL of a just-picked photo, set ONLY on an
   *  optimistic echo so the sender sees the real image while it sends (the remote
   *  `url` is not scan-ready yet -> would flash a broken image). Never sent to or
   *  returned by the BE. MessageBubble prefers it while the row is pending. */
  localPreviewUrl?: string;
}

/** A message row (BE `Message`). */
export interface InboxMessage {
  _id: string;
  threadId: string;
  senderUserId: string | null;
  kind: InboxMessageKind;
  seq: number;
  body: string;
  media: InboxMessageMedia[];
  audioUrl: string | null;
  audioDurationSec: number | null;
  clientMsgId: string;
  createdAt: string;
}

/** The payload the composer sends. `clientMsgId` is generated client-side. */
export interface SendMessageInput {
  clientMsgId: string;
  body?: string;
  media?: Array<{ url: string; mime: string; width?: number; height?: number; sizeBytes?: number }>;
  audioUrl?: string;
  audioDurationSec?: number;
}

/** A category label used by the optional context card (reuses listing taxonomy). */
export type InboxCategory = ListingCategory;

/**
 * One item in the UNIFIED per-person timeline (mirror of BE `PersonTimelineItem`):
 * a hydrated context card OR a chat message, merged from all of a pair's threads
 * and sorted by `createdAt`. Rendered by UnifiedConversationPane. Keep in sync
 * with the BE `PersonTimelineItem` (inbox.service.ts).
 */
export type PersonTimelineItem =
  | {
      type: 'context';
      threadId: string;
      channelType: InboxChannelType;
      contextEntityId: string | null;
      context: InboxThreadContext;
      createdAt: string;
    }
  | {
      type: 'message';
      threadId: string;
      channelType: InboxChannelType;
      message: InboxMessage;
      createdAt: string;
    };

/** The merged timeline + the other party (header) + per-thread newest-seq cursors
 *  (paging + mark-read happen per underlying thread; there is no global cursor).
 *  Mirror of BE `PersonTimeline`. */
export interface PersonTimeline {
  party: InboxParty | null;
  items: PersonTimelineItem[];
  threads: Array<{
    threadId: string;
    channelType: InboxChannelType;
    newestSeq: number;
    /** The OTHER party's read watermark for this thread. My sent message is
     *  "read" (blue double-tick) when its `seq` <= this. Live-updated by the
     *  `inbox:read` socket event. Mirror of BE `PersonTimeline.threads[]`. */
    otherLastReadSeq: number;
  }>;
}
