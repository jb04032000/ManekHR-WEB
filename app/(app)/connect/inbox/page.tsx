import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getMe } from '@/lib/actions/auth.actions';
import {
  getInboxThread,
  listInboxMessages,
  listInboxThreads,
} from '@/features/connect/inbox/inbox.actions';
import InboxScreen from '@/features/connect/inbox/InboxScreen';
import type { ActionResult } from '@/features/connect/profile.types';
import type { InboxMessage, InboxThread } from '@/features/connect/inbox/inbox.types';

/**
 * `/connect/inbox` -- the unified messaging hub (Phase 7).
 *
 * A Server Component (ENGINEERING-STANDARDS #7). It seeds the first thread-list
 * page and, when `?thread=<id>` is present, that thread + its first messages
 * page, so `InboxScreen` mounts with data already in the react-query cache (no
 * duplicate fetch on mount). The Connect shell lives in the route-group layout,
 * so a `?thread=` change re-runs this page but never remounts the shell (#8) --
 * and the client `InboxScreen` reads `?thread=` itself for the instant swap.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('connect.inbox');
  return { title: t('metaTitle') };
}

interface InboxPageProps {
  searchParams: Promise<{ thread?: string | string[] }>;
}

export default async function ConnectInboxPage({ searchParams }: InboxPageProps) {
  const { thread } = await searchParams;
  const threadId = (Array.isArray(thread) ? thread[0] : thread) || null;

  const [me, threadsRes] = await Promise.all([getMe(), listInboxThreads()]);
  const initialThreads: InboxThread[] | null = threadsRes.ok ? threadsRes.data : null;

  let initialThread: InboxThread | null = null;
  let initialMessages: InboxMessage[] | null = null;
  if (threadId) {
    // Reuse the loaded list row when possible to avoid an extra round-trip;
    // otherwise (a deep link to a thread past the first page) hydrate it.
    const fromList = initialThreads?.find((row) => row._id === threadId) ?? null;
    const threadPromise: Promise<ActionResult<InboxThread>> = fromList
      ? Promise.resolve({ ok: true, data: fromList })
      : getInboxThread(threadId);
    const [threadRes, messagesRes] = await Promise.all([
      threadPromise,
      listInboxMessages(threadId),
    ]);
    initialThread = threadRes.ok ? threadRes.data : null;
    initialMessages = messagesRes.ok ? messagesRes.data : null;
  }

  return (
    <InboxScreen
      initialThreads={initialThreads}
      initialThreadId={threadId}
      initialThread={initialThread}
      initialMessages={initialMessages}
      viewerId={me._id}
    />
  );
}
