'use client';

/**
 * ContextCardInline -- renders a `context` timeline item (an application /
 * inquiry / quote summary) as an INLINE card bubble inside the unified
 * per-person conversation, reusing ContextCard's per-kind visuals + role-gated
 * actions. Only the placement differs from the pinned card (left-aligned bubble,
 * not a top banner).
 *
 * Cross-module: wraps ContextCard.tsx; fed by UnifiedConversationPane from the
 * BE `PersonTimelineItem`. Watch: keep the reconstructed-thread fields in sync
 * with whatever ContextCard reads (channelType / context / contextEntityId / _id).
 */

import ContextCard from './ContextCard';
import type {
  InboxChannelType,
  InboxContextEntityType,
  InboxThread,
  PersonTimelineItem,
} from './inbox.types';

type ContextItem = Extract<PersonTimelineItem, { type: 'context' }>;

// channelType -> the source entity type ContextCard expects on the thread.
// candidate_request -> CandidateRequest (Institutes Phase 2, Feature 4): the
// hire-lead context card surfaces in the unified per-person timeline too.
const ENTITY_TYPE: Record<InboxChannelType, InboxContextEntityType | null> = {
  inquiry: 'Inquiry',
  application: 'JobApplication',
  quote: 'Quote',
  candidate_request: 'CandidateRequest',
  dm: null,
  system: null,
};

export default function ContextCardInline({ item }: { item: ContextItem }) {
  // Reconstruct only the InboxThread fields ContextCard reads; the rest are
  // unused by ContextCard but required by the type, so they get inert defaults.
  const thread: InboxThread = {
    _id: item.threadId,
    channelType: item.channelType,
    contextEntityType: ENTITY_TYPE[item.channelType],
    contextEntityId: item.contextEntityId,
    context: item.context,
    party: null,
    lastMessage: null,
    lastActivityAt: item.createdAt,
    unreadCount: 0,
    archived: false,
    muted: false,
    closed: false,
  };
  return (
    <div style={{ alignSelf: 'flex-start', width: '100%', maxWidth: 'min(88%, 540px)' }}>
      <ContextCard thread={thread} />
    </div>
  );
}
