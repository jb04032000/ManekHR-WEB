import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import en from '@/app/messages/en.json';
import InboxScreen from './InboxScreen';
import type { InboxThread } from './inbox.types';

// Decouple from routing, the realtime provider, server actions, and the heavy
// upload / voice chains so the smoke renders the seeded thread list in isolation.
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => null }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/connect/inbox',
}));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'}>{children}</a>
  ),
}));
vi.mock('./InboxProvider', () => ({
  InboxProvider: ({ children }: { children: React.ReactNode }) => children,
  useInbox: () => ({ connectionState: 'idle', onReconnect: () => () => {} }),
}));
vi.mock('./inbox.actions', () => ({
  listInboxThreads: vi.fn(async () => ({ ok: true, data: [] })),
  listInboxMessages: vi.fn(async () => ({ ok: true, data: [] })),
  getInboxThread: vi.fn(),
  markInboxRead: vi.fn(async () => ({ ok: true, data: null })),
  inboxMessagesSince: vi.fn(async () => ({ ok: true, data: [] })),
  sendInboxMessage: vi.fn(),
  blockInboxUser: vi.fn(),
  reportInboxThread: vi.fn(),
}));
vi.mock('@/lib/services/upload.service', () => ({ uploadService: { uploadSingle: vi.fn() } }));
vi.mock('@/components/connect/VoiceNoteRecorder', () => ({ default: () => null }));
vi.mock('./useInboxBadge', () => ({ INBOX_CHANGED_EVENT: 'z360:connect-inbox-changed' }));

const NOW = '2026-05-31T10:00:00.000Z';
const THREADS: InboxThread[] = [
  {
    _id: 't1',
    channelType: 'inquiry',
    contextEntityType: 'Inquiry',
    contextEntityId: 'i1',
    context: null,
    party: { userId: 'u2', name: 'Roop Bridal Studio', avatar: null, handle: 'roop' },
    lastMessage: {
      preview: 'Need 12 panels',
      kind: 'text',
      senderUserId: 'u2',
      seq: 3,
      createdAt: NOW,
    },
    lastActivityAt: NOW,
    unreadCount: 2,
    archived: false,
    muted: false,
    closed: false,
  },
  {
    _id: 't2',
    channelType: 'dm',
    contextEntityType: null,
    contextEntityId: null,
    context: null,
    party: { userId: 'u3', name: 'Imran Sheikh', avatar: null, handle: null },
    lastMessage: { preview: 'Salaam', kind: 'text', senderUserId: 'u3', seq: 1, createdAt: NOW },
    lastActivityAt: NOW,
    unreadCount: 0,
    archived: false,
    muted: false,
    closed: false,
  },
];

function renderScreen(initialThreads: InboxThread[]) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={en}>
        <InboxScreen
          initialThreads={initialThreads}
          initialThreadId={null}
          initialThread={null}
          initialMessages={null}
          viewerId="u1"
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe('InboxScreen', () => {
  it('renders the SSR-seeded person-grouped list and the empty conversation pane', () => {
    renderScreen(THREADS);

    // Title + one row PER PERSON (the two threads are with different people).
    expect(screen.getByRole('heading', { level: 1, name: 'Inbox' })).toBeInTheDocument();
    expect(screen.getByText('Roop Bridal Studio')).toBeInTheDocument();
    expect(screen.getByText('Imran Sheikh')).toBeInTheDocument();

    // With no ?person, the conversation pane shows its empty prompt.
    expect(screen.getByText('Your messages')).toBeInTheDocument();
  });

  it('renders the empty state when there are no conversations', () => {
    renderScreen([]);
    expect(screen.getByText('No conversations yet')).toBeInTheDocument();
  });
});
