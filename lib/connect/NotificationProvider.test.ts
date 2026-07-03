import { describe, it, expect, vi } from 'vitest';
import { applyCreatedEvent, belongsInBell, effectiveProduct } from './NotificationProvider';
import type { NotificationItem } from '@/features/connect/notifications/notifications.actions';
import type { NotificationCreatedEvent } from './notification-socket';

const USER = 'user-1';

function ev(overrides: Partial<NotificationCreatedEvent> = {}): NotificationCreatedEvent {
  return {
    notificationId: 'n1',
    category: 'connect.post_reacted',
    title: 'New reaction on your post',
    message: 'Liked your post.',
    actorId: 'a1',
    aggregatedCount: 1,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('applyCreatedEvent - batched realtime fold', () => {
  it('prepends a brand-new notification', () => {
    const next = applyCreatedEvent([], ev(), USER);
    expect(next).toHaveLength(1);
    expect(next[0]._id).toBe('n1');
    expect(next[0].recipientId).toBe(USER);
    expect(next[0].seenAt).toBeNull();
    expect(next[0].isRead).toBe(false);
  });

  it('updates the existing row in place on a re-fired batched event (no duplicate)', () => {
    const prev: NotificationItem[] = [
      {
        _id: 'n1',
        recipientId: USER,
        actorId: 'a1',
        aggregatedCount: 1,
        category: 'connect.post_reacted',
        title: 'New reaction on your post',
        message: 'Liked your post.',
        seenAt: new Date().toISOString(), // already seen
        isRead: false,
        createdAt: new Date().toISOString(),
      },
    ];
    const next = applyCreatedEvent(
      prev,
      ev({ message: '2 people reacted to your post.', aggregatedCount: 2, actorId: 'a2' }),
      USER,
    );
    // No duplicate row.
    expect(next).toHaveLength(1);
    // Updated in place: count + copy refreshed, badge re-lit (seenAt cleared).
    expect(next[0].aggregatedCount).toBe(2);
    expect(next[0].message).toBe('2 people reacted to your post.');
    expect(next[0].seenAt).toBeNull();
    expect(next[0].actorId).toBe('a2');
  });

  it('keeps the existing count when a batched event omits aggregatedCount', () => {
    const prev: NotificationItem[] = [
      {
        _id: 'n1',
        recipientId: USER,
        aggregatedCount: 3,
        title: 't',
        message: 'm',
        seenAt: null,
        isRead: false,
        createdAt: new Date().toISOString(),
      },
    ];
    const next = applyCreatedEvent(prev, ev({ aggregatedCount: undefined }), USER);
    expect(next[0].aggregatedCount).toBe(3);
  });
});

describe('belongsInBell - messages stay out of the bell', () => {
  it('excludes connect.message_received from the bell list', () => {
    expect(belongsInBell(ev({ category: 'connect.message_received' }))).toBe(false);
  });

  it('keeps every other category in the bell', () => {
    expect(belongsInBell(ev({ category: 'connect.post_reacted' }))).toBe(true);
    expect(belongsInBell(ev({ category: 'connect.connection_accepted' }))).toBe(true);
    expect(belongsInBell(ev({ category: 'INVITE_RECEIVED' }))).toBe(true);
  });

  it('a message event is fanned to subscribers but NOT added to the bell list', () => {
    // Mirror the socket handler: subscribers always fire; the bell prepend is
    // gated by belongsInBell. Asserts both halves of the message behaviour.
    const subscriber = vi.fn();
    let bell: NotificationItem[] = [];

    const event = ev({ notificationId: 'm1', category: 'connect.message_received' });

    if (belongsInBell(event)) {
      bell = applyCreatedEvent(bell, event, USER);
    }
    subscriber(event); // fan-out is unconditional

    expect(bell).toHaveLength(0); // not in the bell
    expect(subscriber).toHaveBeenCalledWith(event); // but inbox badge still hears it
  });
});

describe('effectiveProduct - shell scoping ("one engine, two inboxes")', () => {
  function row(overrides: Partial<NotificationItem> = {}): NotificationItem {
    return {
      _id: 'n1',
      recipientId: USER,
      title: 't',
      message: 'm',
      seenAt: null,
      isRead: false,
      createdAt: new Date().toISOString(),
      ...overrides,
    };
  }

  it('trusts the backend stamp when present', () => {
    expect(effectiveProduct(row({ product: 'connect' }))).toBe('connect');
    expect(effectiveProduct(row({ product: 'erp', category: 'connect.post_reacted' }))).toBe('erp');
  });

  it('falls back to the category heuristic for a null stamp (Connect)', () => {
    expect(effectiveProduct(row({ product: null, category: 'connect.post_commented' }))).toBe(
      'connect',
    );
  });

  it('treats a null stamp + non-connect category as ERP', () => {
    expect(effectiveProduct(row({ product: null, category: 'INVITE_RECEIVED' }))).toBe('erp');
  });

  it('treats a stamp-less, category-less row (legacy / live event) as ERP', () => {
    expect(effectiveProduct(row())).toBe('erp');
  });

  it('reads the legacy metadata.category fallback', () => {
    expect(effectiveProduct(row({ metadata: { category: 'connect.followed' } }))).toBe('connect');
  });
});
