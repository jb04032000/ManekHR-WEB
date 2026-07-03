'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Mention } from '@/features/connect/feed.types';
// Tag-chip click analytics (entity type only, no PII). Links: lib/analytics-events.
import { trackEvent, ConnectEvents } from '@/lib/analytics-events';

// Client component: the chip's onClick stopPropagation needs a browser handler,
// and it is imported by the Server Component PublicPostView (a client island in
// a server tree is fine + standard). Keep 'use client' so the handler is valid.
/**
 * MentionText - renders a plain-text post/comment body, turning each tag's
 * "@<display>" token into a clickable chip linking to the tagged entity. What it
 * does: walks the body once, order-matching each mention's "@<display>" to the
 * next occurrence (chips are atomic in the composer, so the token is always
 * present). Cross-module: consumes feed.types Mention; used by PostCard,
 * PublicPostView, PostComments, ActivityCommentList. Watch: a mention with an
 * empty href (deleted/renamed entity) renders as plain text, never a dead link.
 * No raw HTML is produced (XSS-safe) - only text nodes + next/link elements.
 */
export default function MentionText({ text, mentions }: { text: string; mentions?: Mention[] }) {
  if (!mentions || mentions.length === 0) {
    return <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>;
  }
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  for (const m of mentions) {
    const token = `@${m.display}`;
    const idx = text.indexOf(token, cursor);
    if (idx === -1) continue; // body edited out of sync; skip gracefully
    if (idx > cursor) nodes.push(<span key={key++}>{text.slice(cursor, idx)}</span>);
    if (m.href) {
      nodes.push(
        <Link
          key={key++}
          href={m.href}
          style={{ color: 'var(--cr-primary, #4f46e5)', fontWeight: 600 }}
          onClick={(e) => {
            e.stopPropagation();
            trackEvent(ConnectEvents.mentionClicked, { entity: m.type });
          }}
        >
          {token}
        </Link>,
      );
    } else {
      nodes.push(<span key={key++}>{token}</span>);
    }
    cursor = idx + token.length;
  }
  if (cursor < text.length) nodes.push(<span key={key++}>{text.slice(cursor)}</span>);
  return <span style={{ whiteSpace: 'pre-wrap' }}>{nodes}</span>;
}
