import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useNetworkBadge } from './useNetworkBadge';

type TestNotif = { _id: string; category: string | null; seenAt: string | null };
let mockNotifications: TestNotif[] = [];

// The badge derives purely from the shared NotificationProvider state.
vi.mock('@/lib/connect/NotificationProvider', () => ({
  useNotifications: () => ({ notifications: mockNotifications }),
}));

function Probe() {
  return <span data-testid="count">{useNetworkBadge()}</span>;
}

describe('useNetworkBadge', () => {
  it('counts UNSEEN incoming requests + acceptances, ignoring seen and other categories', () => {
    mockNotifications = [
      { _id: '1', category: 'connect.connection_requested', seenAt: null },
      { _id: '2', category: 'connect.connection_accepted', seenAt: null },
      { _id: '3', category: 'connect.connection_requested', seenAt: '2026-01-01' }, // already seen
      { _id: '4', category: 'connect.followed', seenAt: null }, // unrelated category
      { _id: '5', category: null, seenAt: null }, // no category
    ];
    render(<Probe />);
    expect(screen.getByTestId('count').textContent).toBe('2');
  });

  it('is 0 once everything is seen (the page marks both categories seen on visit)', () => {
    mockNotifications = [
      { _id: '1', category: 'connect.connection_requested', seenAt: '2026-01-01T00:00:00Z' },
      { _id: '2', category: 'connect.connection_accepted', seenAt: '2026-01-01T00:00:00Z' },
    ];
    render(<Probe />);
    expect(screen.getByTestId('count').textContent).toBe('0');
  });
});
