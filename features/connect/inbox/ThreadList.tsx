'use client';

/**
 * ThreadList -- the left pane. One row PER PERSON (the unified inbox groups a
 * pair's threads into a single conversation), linking to `?person=<userId>`.
 * A plain `useQuery` seeded from the server render (no mount refetch); realtime
 * bumps write into this same cache key; "load older" appends by `lastActivityAt`
 * keyset. Grouping + summed unread live in `inbox-format.groupThreadsByPerson`.
 */

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Inbox as InboxIcon, TriangleAlert } from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
// Shared locked empty-state recipe (icon + headline + subhead + CTA). Reused so
// the inbox empty state matches every other Connect surface (feed, network, ...).
import { ConnectEmptyState } from '@/components/connect';
import { listInboxThreads } from './inbox.actions';
import { inboxKeys } from './inbox-cache';
import { groupThreadsByPerson } from './inbox-format';
import { INBOX_THREAD_PAGE_SIZE } from './inbox.types';
import ThreadRow from './ThreadRow';
import type { InboxThread } from './inbox.types';

interface ThreadListProps {
  initialThreads: InboxThread[] | null;
  /** Kept for the screen's prop shape; the unified view selects by ?person=. */
  activeThreadId: string | null;
  pathname: string;
}

export default function ThreadList({ initialThreads, pathname }: ThreadListProps) {
  const t = useTranslations('connect.inbox');
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const person = searchParams.get('person');
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [exhausted, setExhausted] = useState(
    (initialThreads?.length ?? 0) < INBOX_THREAD_PAGE_SIZE && initialThreads !== null,
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: inboxKeys.threads('all'),
    queryFn: async () => {
      const res = await listInboxThreads();
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    ...(initialThreads ? { initialData: initialThreads } : {}),
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const threads = useMemo(() => data ?? [], [data]);
  // A stable mount timestamp for relative-time labels (keeps render pure).
  const [now] = useState(() => Date.now());
  const rows = useMemo(
    () =>
      groupThreadsByPerson(threads).map((g) => ({
        key: g.userId,
        thread: g.representative,
        href: `${pathname}?person=${g.userId}`,
        active: g.userId === person,
      })),
    [threads, pathname, person],
  );
  const canLoadOlder = threads.length >= INBOX_THREAD_PAGE_SIZE && !exhausted;

  const loadOlder = useCallback(async () => {
    if (loadingOlder || threads.length === 0) return;
    const oldest = threads[threads.length - 1]?.lastActivityAt;
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const res = await listInboxThreads(undefined, oldest);
      if (res.ok) {
        if (res.data.length < INBOX_THREAD_PAGE_SIZE) setExhausted(true);
        if (res.data.length > 0) {
          qc.setQueryData<InboxThread[]>(inboxKeys.threads('all'), (old) => {
            const list = old ?? [];
            const seen = new Set(list.map((x) => x._id));
            return [...list, ...res.data.filter((x) => !seen.has(x._id))];
          });
        }
      }
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, qc, threads]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ padding: '14px 14px 12px' }}>
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: 'var(--cr-text)' }}>
          {t('title')}
        </h1>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {isLoading ? (
          <p style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--cr-text-4)' }}>
            {t('list.loading')}
          </p>
        ) : isError ? (
          <div role="alert" style={{ padding: 24, textAlign: 'center', color: 'var(--cr-text-4)' }}>
            <TriangleAlert size={22} aria-hidden style={{ color: 'var(--cr-error)' }} />
            <p style={{ margin: '8px 0', fontSize: 13 }}>{t('list.errorBody')}</p>
            <DsButton dsVariant="ghost" dsSize="sm" onClick={() => void refetch()}>
              {t('list.retry')}
            </DsButton>
          </div>
        ) : rows.length === 0 ? (
          // Day-1 empty inbox: give the user a way OUT of the dead end. The CTA
          // lives here (not just the desktop detail pane) so mobile -- where only
          // this list shows -- also gets the action. Targets: network suggestions
          // (find people -> startInboxDm) and the marketplace (message a seller).
          <ConnectEmptyState
            variant="inline"
            icon={<InboxIcon size={24} aria-hidden />}
            title={t('list.emptyTitle')}
            description={t('list.emptyBody')}
            primaryAction={{ label: t('list.emptyCta'), href: '/connect/network?tab=suggestions' }}
            secondaryAction={{ label: t('list.emptyCtaBrowse'), href: '/connect/marketplace' }}
          />
        ) : (
          <>
            <ul
              aria-label={t('threadListAria')}
              style={{ listStyle: 'none', margin: 0, padding: 0 }}
            >
              {rows.map((r) => (
                <li key={r.key}>
                  <ThreadRow thread={r.thread} href={r.href} active={r.active} now={now} />
                </li>
              ))}
            </ul>
            {canLoadOlder && (
              <div style={{ padding: '12px 0', textAlign: 'center' }}>
                <DsButton
                  dsVariant="ghost"
                  dsSize="sm"
                  onClick={() => void loadOlder()}
                  disabled={loadingOlder}
                >
                  {loadingOlder ? t('list.loadingOlder') : t('list.loadOlder')}
                </DsButton>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
