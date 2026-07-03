import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import en from '@/app/messages/en.json';
import UnifiedConversationPane from './UnifiedConversationPane';
import { inboxKeys } from './inbox-cache';
import type { InboxThread, PersonTimeline } from './inbox.types';

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
// ContextCardInline -> ContextCard imports these server actions; stub them.
vi.mock('../jobs/jobs.actions', () => ({
  setApplicationStatus: vi.fn(),
  acceptApplication: vi.fn(),
}));
vi.mock('../rfq/rfq.actions', () => ({
  acceptQuote: vi.fn(),
  declineQuote: vi.fn(),
  shortlistQuote: vi.fn(),
  withdrawQuote: vi.fn(),
}));

// VoiceNoteRecorder touches MediaRecorder APIs jsdom lacks; stub it.
vi.mock('@/components/connect/VoiceNoteRecorder', () => ({ default: () => null }));

const getPersonTimeline = vi.fn();
const markInboxRead = vi.fn(async () => ({ ok: true, data: null }));
const sendInboxMessage = vi.fn(async () => ({ ok: true, data: {} }));
const startInboxDm = vi.fn(async () => ({ ok: true, data: { _id: 'dm1' } }));
vi.mock('./inbox.actions', () => ({
  getPersonTimeline: (...a: unknown[]) => getPersonTimeline(...(a as [])),
  markInboxRead: (...a: unknown[]) => markInboxRead(...(a as [])),
  sendInboxMessage: (...a: unknown[]) => sendInboxMessage(...(a as [])),
  startInboxDm: (...a: unknown[]) => startInboxDm(...(a as [])),
  blockInboxUser: vi.fn(async () => ({ ok: true, data: null })),
  reportInboxThread: vi.fn(async () => ({ ok: true, data: null })),
}));

beforeEach(() => vi.clearAllMocks());

function renderPane(timeline: PersonTimeline, seedThreads?: InboxThread[]) {
  getPersonTimeline.mockResolvedValue({ ok: true, data: timeline });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (seedThreads) qc.setQueryData(inboxKeys.threads('all'), seedThreads);
  const utils = render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={en}>
        <UnifiedConversationPane otherUserId="u2" viewerId="me" onBack={() => {}} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { ...utils, qc };
}

const seededThread = (id: string, unreadCount: number): InboxThread => ({
  _id: id,
  channelType: 'dm',
  contextEntityType: null,
  contextEntityId: null,
  context: null,
  party: { userId: 'u2', name: 'Meera', avatar: null, handle: null },
  lastMessage: null,
  lastActivityAt: '2026-06-14T09:11:00.000Z',
  unreadCount,
  archived: false,
  muted: false,
  closed: false,
});

const msg = (id: string, body: string, sender: string, createdAt: string) => ({
  _id: id,
  threadId: 'dm',
  senderUserId: sender,
  kind: 'text' as const,
  seq: 1,
  body,
  media: [],
  audioUrl: null,
  audioDurationSec: null,
  clientMsgId: id,
  createdAt,
});

describe('UnifiedConversationPane', () => {
  it('renders the merged timeline (inline context card + messages) and marks read', async () => {
    const timeline: PersonTimeline = {
      party: { userId: 'u2', name: 'Meera', avatar: null, handle: null },
      items: [
        {
          type: 'context',
          threadId: 'a1',
          channelType: 'application',
          contextEntityId: 'app1',
          createdAt: '2026-06-14T09:00:00.000Z',
          context: {
            kind: 'application',
            jobId: 'J7',
            title: 'Aari karigar',
            companyName: null,
            companyLogo: null,
            wageType: null,
            wageMin: null,
            wageMax: null,
            district: null,
            status: 'applied',
            viewed: false,
            jobStatus: 'open',
            viewerRole: 'applicant',
            applicant: null,
          },
        },
        {
          type: 'message',
          threadId: 'dm',
          channelType: 'dm',
          createdAt: '2026-06-14T09:10:00.000Z',
          message: msg('m1', 'hi there', 'me', '2026-06-14T09:10:00.000Z'),
        },
        {
          type: 'message',
          threadId: 'dm',
          channelType: 'dm',
          createdAt: '2026-06-14T09:11:00.000Z',
          message: msg('m2', 'hello back', 'u2', '2026-06-14T09:11:00.000Z'),
        },
      ],
      threads: [
        { threadId: 'dm', channelType: 'dm', newestSeq: 2, otherLastReadSeq: 0 },
        { threadId: 'a1', channelType: 'application', newestSeq: 0, otherLastReadSeq: 0 },
      ],
    };
    renderPane(timeline);

    expect(await screen.findByText('Meera')).toBeInTheDocument(); // header
    expect(await screen.findByText('Aari karigar')).toBeInTheDocument(); // the inline card
    expect(screen.getByText('hi there')).toBeInTheDocument();
    expect(screen.getByText('hello back')).toBeInTheDocument();
    // marks the dm thread (newestSeq 2) read; the no-message application thread is skipped
    await waitFor(() => expect(markInboxRead).toHaveBeenCalledWith('dm', 2));
    expect(markInboxRead).not.toHaveBeenCalledWith('a1', 0);
  });

  it('shows a sent message instantly with a pending state (optimistic echo)', async () => {
    const timeline: PersonTimeline = {
      party: { userId: 'u2', name: 'Meera', avatar: null, handle: null },
      items: [],
      threads: [{ threadId: 'dm', channelType: 'dm', newestSeq: 0, otherLastReadSeq: 0 }],
    };
    // Hold the send open so the success refetch never runs during the assertion;
    // this isolates the INSTANT echo (the whole point of the fix).
    let resolveSend: (v: { ok: true; data: object }) => void = () => {};
    sendInboxMessage.mockImplementation(() => new Promise((r) => (resolveSend = r)));
    renderPane(timeline);

    await screen.findByText('Meera'); // pane loaded

    fireEvent.change(screen.getByLabelText('Type a message'), {
      target: { value: 'hello world' },
    });
    fireEvent.click(screen.getByLabelText('Send'));

    // The bubble + "Sending..." show BEFORE the server resolves.
    expect(await screen.findByText('hello world')).toBeInTheDocument();
    expect(screen.getByText('Sending...')).toBeInTheDocument();

    resolveSend({ ok: true, data: {} });
  });

  it('removes the optimistic echo and restores the draft when send fails', async () => {
    const timeline: PersonTimeline = {
      party: { userId: 'u2', name: 'Meera', avatar: null, handle: null },
      items: [],
      threads: [{ threadId: 'dm', channelType: 'dm', newestSeq: 0, otherLastReadSeq: 0 }],
    };
    // Hold the send open so we can observe the pending bubble before it fails.
    let failSend: () => void = () => {};
    sendInboxMessage.mockImplementation(
      () =>
        new Promise((res) => {
          failSend = () =>
            res({ ok: false, error: 'boom' } as unknown as { ok: true; data: object });
        }),
    );
    renderPane(timeline);

    await screen.findByText('Meera');

    const input = screen.getByLabelText('Type a message') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'will fail' } });
    fireEvent.click(screen.getByLabelText('Send'));

    // Optimistic bubble shows while pending (composer is cleared, so this text is
    // the bubble, not the input).
    expect(await screen.findByText('will fail')).toBeInTheDocument();
    expect(screen.getByText('Sending...')).toBeInTheDocument();

    failSend();
    // The echo is removed and the draft is restored so the user can retry.
    await waitFor(() => expect(screen.queryByText('Sending...')).not.toBeInTheDocument());
    await waitFor(() => expect(input.value).toBe('will fail'));
  });

  it('shows my message as read (blue double-tick) once the other party has read it', async () => {
    const timeline: PersonTimeline = {
      party: { userId: 'u2', name: 'Meera', avatar: null, handle: null },
      items: [
        {
          type: 'message',
          threadId: 'dm',
          channelType: 'dm',
          createdAt: '2026-06-14T09:10:00.000Z',
          message: msg('m1', 'hi there', 'me', '2026-06-14T09:10:00.000Z'),
        },
      ],
      // OTHER party has read up to seq 1 -> my seq-1 message is read.
      threads: [{ threadId: 'dm', channelType: 'dm', newestSeq: 1, otherLastReadSeq: 1 }],
    };
    renderPane(timeline);
    expect(await screen.findByLabelText('Read')).toBeInTheDocument();
  });

  it('shows my message as sent (single tick) when not yet read', async () => {
    const timeline: PersonTimeline = {
      party: { userId: 'u2', name: 'Meera', avatar: null, handle: null },
      items: [
        {
          type: 'message',
          threadId: 'dm',
          channelType: 'dm',
          createdAt: '2026-06-14T09:10:00.000Z',
          message: msg('m1', 'hi there', 'me', '2026-06-14T09:10:00.000Z'),
        },
      ],
      threads: [{ threadId: 'dm', channelType: 'dm', newestSeq: 1, otherLastReadSeq: 0 }],
    };
    renderPane(timeline);
    await screen.findByText('hi there');
    expect(screen.getByLabelText('Sent')).toBeInTheDocument();
    expect(screen.queryByLabelText('Read')).not.toBeInTheDocument();
  });

  it('clears the thread-list cache unread count for the opened conversation', async () => {
    const timeline: PersonTimeline = {
      party: { userId: 'u2', name: 'Meera', avatar: null, handle: null },
      items: [
        {
          type: 'message',
          threadId: 'dm',
          channelType: 'dm',
          createdAt: '2026-06-14T09:11:00.000Z',
          message: msg('m2', 'hello back', 'u2', '2026-06-14T09:11:00.000Z'),
        },
      ],
      threads: [{ threadId: 'dm', channelType: 'dm', newestSeq: 2, otherLastReadSeq: 0 }],
    };
    // The list pane caches this row showing unread=1; opening the chat must zero it.
    const { qc } = renderPane(timeline, [seededThread('dm', 1)]);

    await waitFor(() => expect(markInboxRead).toHaveBeenCalledWith('dm', 2));
    await waitFor(() => {
      const cached = qc.getQueryData<InboxThread[]>(inboxKeys.threads('all'));
      expect(cached?.find((t) => t._id === 'dm')?.unreadCount).toBe(0);
    });
  });
});
