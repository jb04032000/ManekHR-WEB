/**
 * ManekHR Connect - Network (Phase 2) types. Mirror the `connect/network`
 * backend schemas + the `GET /connect/people` batch lookup.
 */

/** A connection request's lifecycle state. */
export type ConnectionRequestStatus = 'pending' | 'accepted' | 'ignored' | 'withdrawn';

/** A person-to-person connection request. */
export interface ConnectionRequest {
  _id: string;
  fromUserId: string;
  toUserId: string;
  status: ConnectionRequestStatus;
  note: string | null;
  respondedAt: string | null;
  createdAt: string;
}

/** The followee kind a `Follow` points at. Phase 2 creates only `user`. */
export type FollowFolloweeType = 'user' | 'companyPage';

/** An asymmetric follow edge. */
export interface Follow {
  _id: string;
  followerId: string;
  followeeType: FollowFolloweeType;
  followeeId: string;
  createdAt: string;
}

/** One of the caller's connections - the other person + when it formed. */
export interface ConnectionSummary {
  userId: string;
  since: string;
}

/** The Invitations sub-tabs. */
export type InvitationBox = 'received' | 'sent' | 'archive';

/** The response a recipient gives a pending request. */
export type ConnectionRequestAction = 'accept' | 'ignore';

/** Network badge counts for the caller. */
export interface NetworkCounts {
  pendingRequests: number;
  connections: number;
  /** People the caller follows. */
  following: number;
  /** People who follow the caller. */
  followers: number;
}

/**
 * Viewer-facing identity for a people card - resolved from the
 * `GET /connect/people` batch lookup. `name` / `avatar` are canonical on
 * `User`; `headline` is the person's `ConnectProfile` one-liner.
 */
export interface PersonRef {
  userId: string;
  name: string;
  avatar: string | null;
  headline: string | null;
  /**
   * The person's "open to" signal, derived by the backend `getPeopleByIds`
   * (`/connect/people`) -> drives the ConnectAvatar floating ring. Optional +
   * nullable: a network-scoped or profile-less person resolves to null (renders
   * a bare avatar). Keep in sync with backend `ConnectPersonRef.openStatus`.
   */
  openStatus?: 'work' | 'hiring' | null;
  /** True for a seeded sample person (User.isDemo), surfaced by the backend
   *  `getPeopleByIds` -> drives the SampleBadge on a people card + the demo
   *  down-rank. Optional + absent for a real member. Keep `isDemo` in sync with
   *  backend `ConnectPersonRef.isDemo` + every other Connect type mirror. */
  isDemo?: boolean;
}

/**
 * A ranked "people you may know" suggestion - mirrors the backend
 * `PersonSuggestion`. The signal fields (`mutualConnections`, `sharedSkills`,
 * `sharedWorkspace`, `sharedErpParty`) drive the reason line + the filter pills.
 */
export interface Suggestion {
  userId: string;
  score: number;
  mutualConnections: number;
  sharedSkills: string[];
  sharedWorkspace: boolean;
  /** True when this person is in the viewer's own ERP party book (phone match). */
  sharedErpParty: boolean;
  /** True for a seeded sample person (User.isDemo) -> drives the SampleBadge on a
   *  suggestion card + the demo down-rank. Optional; absent = real member. Keep
   *  `isDemo` in sync with backend `PersonSuggestion` + every Connect mirror. */
  isDemo?: boolean;
}

/**
 * The viewer's relationship to another user - drives the Connect / Follow
 * buttons on `/u/[userId]`. `self` is true when the viewer is that user.
 */
export interface RelationshipState {
  connected: boolean;
  incomingRequest: boolean;
  outgoingRequest: boolean;
  following: boolean;
  self: boolean;
  /** Pending incoming request id (when `incomingRequest`) - inline Accept/Ignore. */
  incomingRequestId: string | null;
  /** Pending outgoing request id (when `outgoingRequest`) - inline Withdraw. */
  outgoingRequestId: string | null;
}
