'use client';

/**
 * InboxScreen -- the two-pane inbox. URL-driven: `?person=<userId>` selects the
 * open per-person conversation (the unified "contexts as inline messages" view).
 * On desktop both panes show side by side; below `md` the list and the
 * conversation SWAP on the query param (the screen stays mounted, so the browser
 * back button just works). The `/inbox` realtime socket is mounted here via
 * `InboxProvider` (only while the inbox is open -- a 100k-concurrency choice).
 */

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { MessageSquare } from 'lucide-react';
import ConnectPage from '@/components/connect/ConnectPage';
// Shared locked empty-state recipe so the detail pane matches the list pane and
// the rest of Connect (feed, network, ...).
import { ConnectEmptyState } from '@/components/connect';
import { getInboxThread, listInboxThreads } from './inbox.actions';
import { inboxKeys } from './inbox-cache';
import { InboxProvider } from './InboxProvider';
import ThreadList from './ThreadList';
import UnifiedConversationPane from './UnifiedConversationPane';
import './inbox.css';
import type { InboxMessage, InboxThread } from './inbox.types';

export interface InboxScreenProps {
  initialThreads: InboxThread[] | null;
  /** Retained for the route's server props; the unified view fetches per person. */
  initialThreadId: string | null;
  initialThread: InboxThread | null;
  initialMessages: InboxMessage[] | null;
  viewerId: string;
}

export default function InboxScreen(props: InboxScreenProps) {
  return (
    <InboxProvider>
      <InboxScreenInner {...props} />
    </InboxProvider>
  );
}

function InboxScreenInner({ initialThreads, viewerId }: InboxScreenProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('connect.inbox');
  const personId = searchParams.get('person');
  const back = () => router.push(pathname, { scroll: false });

  // Read the SAME thread cache ThreadList owns (seeded from the server snapshot,
  // bumped by realtime) so the placeholder can tell "no conversations at all"
  // apart from "none selected yet". No own fetch -- ThreadList drives the query;
  // this just subscribes so the pane re-renders when the count changes.
  const { data: threadsForEmpty } = useQuery({
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
  const hasNoConversations = (threadsForEmpty?.length ?? 0) === 0;

  // Back-compat: legacy deep-links (notifications, inquiry rows, header) still
  // point at `?thread=<id>`. Resolve the thread's other party and swap to
  // `?person=` so those links open the unified conversation. The `?channel=`
  // links just land on the list (no per-person target) -- acceptable.
  const legacyThreadId = searchParams.get('thread');
  useEffect(() => {
    if (!legacyThreadId || personId) return;
    let cancelled = false;
    void getInboxThread(legacyThreadId).then((res) => {
      if (cancelled) return;
      if (res.ok && res.data.party?.userId) {
        router.replace(`${pathname}?person=${res.data.party.userId}`, { scroll: false });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [legacyThreadId, personId, pathname, router]);

  // Focus management across the list <-> conversation swap (never drop to <body>).
  const listRegionRef = useRef<HTMLElement | null>(null);
  const prevRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (prevRef.current === personId) return;
    const had = prevRef.current;
    prevRef.current = personId;
    if (!personId && had) listRegionRef.current?.focus();
  }, [personId]);

  return (
    <ConnectPage>
      <div
        className="cn-inbox-shell"
        style={
          {
            '--cn-gold': '#c79a3a',
            '--cn-gold-bright': '#e6bb52',
          } as React.CSSProperties
        }
      >
        <section
          ref={listRegionRef}
          tabIndex={-1}
          aria-label="Conversations"
          className={`${personId ? 'hidden md:flex' : 'flex'} w-full flex-col md:w-[340px] md:flex-shrink-0`}
          style={{ borderRight: '1px solid var(--cr-border-light)', outline: 'none', minHeight: 0 }}
        >
          <ThreadList initialThreads={initialThreads} activeThreadId={null} pathname={pathname} />
        </section>

        <section
          aria-label="Conversation"
          className={`${personId ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}
          style={{ minHeight: 0 }}
        >
          {personId ? (
            <UnifiedConversationPane otherUserId={personId} viewerId={viewerId} onBack={back} />
          ) : (
            // Desktop-only placeholder (mobile hides this pane until a person is
            // picked). Two cases: an empty inbox gets a welcoming "nothing here
            // yet" message -- the action lives in the list pane so we don't double
            // it -- while a populated inbox keeps the "pick a conversation" prompt.
            <ConnectEmptyState
              variant="page"
              icon={<MessageSquare size={30} aria-hidden />}
              title={hasNoConversations ? t('emptyInboxTitle') : t('selectThreadTitle')}
              description={hasNoConversations ? t('emptyInboxBody') : t('selectThreadBody')}
            />
          )}
        </section>
      </div>
    </ConnectPage>
  );
}
