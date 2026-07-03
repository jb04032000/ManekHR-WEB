'use client';

/**
 * ThreadRow -- one conversation in the thread list (Phase 7, I3b). Memoized so a
 * realtime bump or a filter change only re-renders the rows that changed. A
 * `next/link` (URL-driven `?thread=`, no scroll jump) so the browser back button
 * works on mobile and the row is a real, focusable navigation target.
 */

import { memo } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { DsAvatar } from '@/components/ui';
// Per-item "Sample" disclosure pill on a seeded demo correspondent (party.isDemo).
import SampleBadge from '@/components/connect/SampleBadge';
import type { InboxThread } from './inbox.types';
import { relativeTime, threadPreview } from './inbox-format';

interface ThreadRowProps {
  thread: InboxThread;
  href: string;
  active: boolean;
  /** Injected so relative-time stays deterministic + the memo stays pure. */
  now: number;
}

function ThreadRowImpl({ thread, href, active, now }: ThreadRowProps) {
  const t = useTranslations('connect.inbox');
  const locale = useLocale();

  const name =
    thread.party?.name ??
    (thread.channelType === 'system' ? t('systemName') : t('list.unknownParty'));

  const preview = threadPreview(thread);
  const previewText =
    preview.kind === 'photo'
      ? t('preview.photo')
      : preview.kind === 'voice'
        ? t('preview.voice')
        : preview.kind === 'text'
          ? preview.text
          : // A context thread with no message yet shows its SUBJECT, not the
            // generic "No messages yet" (it is never really empty). The preview
            // key tracks the context kind (inquiry / application / quote /
            // candidate_request). The interpolation field differs by kind: most
            // contexts expose `title`, but candidate_request (Institutes Phase 2,
            // Feature 4) uses `pageName` (the institute), so pass `name` for it.
            // Note: a candidate_request thread ALWAYS seeds a first message on the
            // BE (CandidateRequestService.seedInboxThread falls back to a default
            // body when the business sends no pitch), so this branch is never hit
            // for it in practice. Wired here defensively so the list row never
            // shows a raw missing key if that ever changes. Keep these kinds in
            // sync with the BE ThreadContext union + the inbox `preview.*` keys.
            thread.context
            ? thread.context.kind === 'candidate_request'
              ? t('preview.candidate_request', { name: thread.context.pageName })
              : t(`preview.${thread.context.kind}`, { title: thread.context.title })
            : t('preview.empty');

  const rel = relativeTime(thread.lastActivityAt, now);
  const timeLabel =
    rel.unit === 'now'
      ? t('time.now')
      : rel.unit === 'minutes'
        ? t('time.minutes', { count: rel.count })
        : rel.unit === 'hours'
          ? t('time.hours', { count: rel.count })
          : rel.unit === 'days'
            ? t('time.days', { count: rel.count })
            : new Date(thread.lastActivityAt).toLocaleDateString(locale, {
                day: 'numeric',
                month: 'short',
              });

  const unread = thread.unreadCount ?? 0;

  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? 'true' : undefined}
      aria-label={t('list.rowAria', { name, count: unread })}
      className="cn-thread-row no-underline"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 14px',
        borderBottom: '1px solid var(--cr-border-light)',
        color: 'var(--cr-text)',
        textDecoration: 'none',
      }}
    >
      <DsAvatar name={name} src={thread.party?.avatar ?? undefined} size={48} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 14,
              fontWeight: unread > 0 ? 700 : 600,
              color: 'var(--cr-text)',
            }}
          >
            {name}
          </span>
          {thread.party?.isDemo && <SampleBadge size="sm" />}
          <span style={{ flexShrink: 0, fontSize: 11.5, color: 'var(--cr-text-4)' }}>
            {timeLabel}
          </span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 12.5,
              color: unread > 0 ? 'var(--cr-text-2)' : 'var(--cr-text-4)',
              fontWeight: unread > 0 ? 600 : 400,
            }}
          >
            {previewText}
          </span>
          {unread > 0 && (
            <span
              aria-hidden
              style={{
                flexShrink: 0,
                minWidth: 18,
                height: 18,
                padding: '0 5px',
                borderRadius: 'var(--cr-radius-full)',
                background: 'var(--cr-primary)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}

const ThreadRow = memo(ThreadRowImpl);
export default ThreadRow;
