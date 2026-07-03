/**
 * ManekHR Connect - Feed (Phase 3) types. Mirror the `connect/feed` backend
 * schemas + the `GET /me/connect/feed` read shape. Mongo `ObjectId`s + `Date`s
 * arrive as strings over JSON.
 */

import type { PersonRef } from './network.types';

/** A resolved @mention (tag) - link-ready, mirrors the backend Mention shape. */
export interface Mention {
  type: 'profile' | 'company' | 'storefront';
  refId: string;
  display: string;
  href: string;
}

/** A post's type - set by the composer mode that created it. */
export type PostKind = 'text' | 'photo' | 'video' | 'document' | 'voice';

/** An attachment's kind. */
export type PostMediaType = 'image' | 'video' | 'document';

/** Who can see a post. */
export type PostVisibility = 'public' | 'connections';

/** How a multi-photo `photo` post renders in the feed. */
export type PostMediaLayout = 'grid' | 'carousel';

/** The two feed tabs - `following` (chronological) + `foryou` (ranked). */
export type FeedTab = 'following' | 'foryou';

/**
 * A "show me less" signal - mirrors the backend `NEGATIVE_SIGNAL_KINDS`.
 * `hide_post` / `not_interested` target a post id; `mute_author` an author id.
 */
export type NegativeSignalKind = 'hide_post' | 'not_interested' | 'mute_author';

/** One photo / video / document attachment on a post. */
export interface PostMedia {
  url: string;
  type: PostMediaType;
  caption?: string;
  /** Video only: poster (thumbnail) image URL for instant poster-first render. */
  posterUrl?: string;
  /** Video only: server-parsed clip length in seconds. */
  durationSec?: number;
}

/** The recording on a `voice`-kind post. */
export interface PostAudio {
  url: string;
  durationSec: number;
  /** Auto / edited transcript - `null` until a provider transcribes it. */
  transcript?: string | null;
  transcriptLang?: string | null;
}

/** A feed post's stored data. */
export interface FeedPost {
  _id: string;
  authorId: string;
  kind: PostKind;
  body: string;
  media: PostMedia[];
  /** How a multi-photo `photo` post renders - `grid` (default) or `carousel`.
   *  Optional: legacy posts predate the field (absent renders as `grid`). */
  mediaLayout?: PostMediaLayout;
  audio: PostAudio | null;
  hashtags: string[];
  tags: string[];
  visibility: PostVisibility;
  reactionCount: number;
  commentCount: number;
  /** Denormalized unique-viewer tally - rendered as "N views". */
  viewCount: number;
  /** Set when this post is a repost - the ROOT original's id. `null` otherwise. */
  repostOf?: string | null;
  /** Running repost tally on an original. */
  repostCount: number;
  /** Set once the author edits the post after publishing; `null`/absent until
   *  then. ISO timestamp. Drives the "edited" label. */
  editedAt?: string | null;
  /** Denormalized - the author earned the ERP-linked badge at post time. */
  authorErpLinked: boolean;
  /** Denormalized at create from the author's User.isDemo (mirrors authorErpLinked).
   *  True = seeded sample content; drives the SampleBadge + feed down-rank. Optional:
   *  legacy posts predate the field (absent reads as a real, non-demo post). Keep the
   *  field name `isDemo` in sync with the BE Post schema + every other Connect mirror. */
  isDemo?: boolean;
  authorSkills: string[];
  /** Resolved @mentions (tags) on this post - drives MentionText link rendering.
   *  Backend stores + returns them; absent on legacy posts (renders as plain text). */
  mentions?: Mention[];
  /** Set when the post was published AS a company page - the page id. The feed
   *  hydrates this into `companyPage` so the author block renders the page. */
  companyPageId?: string | null;
  /** ISO timestamp. */
  createdAt: string;
}

/** Minimal company-page identity for the page-post author block (batch-resolved). */
export interface CompanyPageRef {
  id: string;
  name: string;
  slug: string;
  logo: string;
  /** True when the page is backed by a ManekHR ERP workspace (erpWorkspaceId set).
   *  Additive (BE getRefs now selects erpWorkspaceId). Feeds the jobs-board card's
   *  quiet "ERP verified" badge (features/connect/jobs/JobCard.tsx); the feed author
   *  block ignores it. Person-posted jobs have no ERP concept, so they are never
   *  badged. Keep in sync with the BE CompanyPageRef shape. */
  erpLinked?: boolean;
  /** Forward hook for a future GST-verification feature - mirrors JobEmployerRef /
   *  the detail employer ref. The JobCard badge is wired (gated on this), but the
   *  BE does not set it yet, so it stays off until real GST verification ships. */
  gstVerified?: boolean;
}

/** A feed post + the viewer's own engagement state + why it surfaced. */
export interface FeedItem extends FeedPost {
  viewerReacted: boolean;
  /** True when the viewer has a plain repost of this post's root. */
  viewerReposted: boolean;
  /** True when the viewer has saved (bookmarked) this post. */
  viewerSaved: boolean;
  /**
   * Why this surfaced - `in_network` | `trending` | `topic` | `network_out` |
   * `geo`. Discovery items show a "why am I seeing this" chip; in-network posts
   * + the Following tab carry none.
   */
  origin?: string;
  /** i18n key (under `connect.feed.post.reason`) for the chip, e.g. `trending`. */
  reason?: string;
  /** The embedded ROOT original for a repost (raw - author unresolved). */
  original?: FeedPost | null;
}

/**
 * A feed item with its author identity resolved - the shape the feed UI
 * renders. The `getFeed` server action hydrates `author` from the
 * `connect/people` batch lookup; `null` when the author cannot be resolved.
 * A repost's embedded `original` is hydrated the same way.
 */
export interface HydratedFeedItem extends FeedItem {
  author: PersonRef | null;
  /** Resolved page identity when this is a page post (`companyPageId` set);
   *  `null`/absent for a personal post. Drives the page author block. */
  companyPage?: CompanyPageRef | null;
  /** The embedded original for a repost, author resolved. */
  original?: HydratedFeedItem | null;
}

/** One page of a hydrated feed read. */
export interface HydratedFeedPage {
  posts: HydratedFeedItem[];
  /** Pass back as the next `getFeed` cursor; `null` when caught up. */
  nextCursor: string | null;
  /** True when the feed has reached its end (design doc §14). */
  caughtUp: boolean;
}

/** The toggle result from `reactToPost` / `unreactFromPost`. */
export interface ReactionResult {
  reacted: boolean;
  reactionCount: number;
}

/** The From-your-ERP callout summary (design doc §9.4). */
export interface ErpSummary {
  /** True when the viewer owns a workspace - the callout renders only then. */
  owner: boolean;
  karigarCount: number;
  /** This month's payroll, in paise. */
  payrollPaise: number;
}

/** A comment on a post. Threading is one level deep (`parentId`). */
export interface FeedComment {
  _id: string;
  postId: string;
  authorId: string;
  body: string;
  /** A top-level comment's `parentId` is `null`; a reply points at one. */
  parentId: string | null;
  /** Resolved @mentions on this comment - drives MentionText link rendering. */
  mentions?: Mention[];
  createdAt: string;
}

/** A comment with its author identity resolved (web-side hydration). */
export interface HydratedComment extends FeedComment {
  author: PersonRef | null;
}

/**
 * One page of a post's comment thread, authors resolved. `items` is the flat
 * [top-level (newest-first) + their replies] list the UI regroups by `parentId`;
 * `nextCursor` loads the next (older) page of top-level comments. Mirrors the
 * backend `CommentService.listComments` envelope.
 */
export interface HydratedCommentsPage {
  items: HydratedComment[];
  nextCursor: string | null;
}

/** The payload `editPost` sends - the editable subset of a post. */
export interface EditPostInput {
  body?: string;
  tags?: string[];
  visibility?: PostVisibility;
  /** Flip a photo post between `grid` and `carousel` (display-only, no re-upload). */
  mediaLayout?: PostMediaLayout;
  /** @mentions (tags) chosen in the composer picker. href computed server-side. */
  mentions?: { type: 'profile' | 'company' | 'storefront'; refId: string; display: string }[];
}

/** The payload `createPost` sends - mirrors the backend `CreatePostDto`. */
export interface CreatePostInput {
  kind: PostKind;
  body?: string;
  media?: PostMedia[];
  /** The recording - only on a `voice` post. */
  audio?: PostAudio;
  tags?: string[];
  visibility?: PostVisibility;
  /** How a multi-photo `photo` post renders - `grid` (default) or `carousel`. */
  mediaLayout?: PostMediaLayout;
  /** Publish AS a company page the caller owns (the post fans out to the page's
   *  followers). Omit for a normal personal post. */
  companyPageId?: string;
  /** @mentions (tags) chosen in the composer picker. href computed server-side. */
  mentions?: { type: 'profile' | 'company' | 'storefront'; refId: string; display: string }[];
}

/**
 * The three profile-Activity views (LinkedIn-style Activity tab). `posts` +
 * `reactions` return a feed page (`HydratedFeedPage`); `comments` returns the
 * caller's comments with a parent-post preview (`HydratedActivityCommentsPage`).
 */
export type ActivityType = 'posts' | 'comments' | 'reactions';

/**
 * One of the caller's own comments + a preview of the post it sits on (raw -
 * the parent's author is unresolved). `post` is `null` when the parent was
 * since deleted (the comment still lists, without a live link target).
 */
export interface ActivityComment {
  _id: string;
  postId: string;
  body: string;
  /** Resolved @mentions on this comment - drives MentionText link rendering. */
  mentions?: Mention[];
  /** ISO timestamp. */
  createdAt: string;
  post: FeedPost | null;
}

/** An activity comment with its parent-post author resolved (web hydration). */
export interface HydratedActivityComment extends ActivityComment {
  post: (FeedPost & { author: PersonRef | null }) | null;
}

/** One page of the caller's own comments (raw). */
export interface ActivityCommentsPage {
  comments: ActivityComment[];
  nextCursor: string | null;
  caughtUp: boolean;
}

/** One page of the caller's own comments, parent authors resolved. */
export interface HydratedActivityCommentsPage {
  comments: HydratedActivityComment[];
  nextCursor: string | null;
  caughtUp: boolean;
}
