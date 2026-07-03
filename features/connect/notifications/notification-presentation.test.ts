import { describe, expect, it } from 'vitest';
import { groupOf, primaryAction, type TopicGroup } from './notification-presentation';
import type { NotificationItem } from './notifications.actions';

function n(category: string, extra: Partial<NotificationItem> = {}): NotificationItem {
  return {
    _id: 'x',
    recipientId: 'r',
    category,
    title: 't',
    message: 'm',
    isRead: false,
    createdAt: '2026-06-09T00:00:00.000Z',
    ...extra,
  } as NotificationItem;
}

describe('groupOf', () => {
  const cases: Array<[string, TopicGroup | null]> = [
    ['connect.post_reacted', 'feed'],
    ['connect.connection_requested', 'network'],
    ['connect.page_followed', 'network'],
    ['connect.inquiry_received', 'marketplace'],
    ['connect.job_application_received', 'jobs'],
    ['connect.message_received', 'messages'],
    ['INVITE_RECEIVED', 'system'],
  ];
  it.each(cases)('maps %s -> %s', (cat, group) => {
    expect(groupOf(n(cat))).toBe(group);
  });
});

describe('primaryAction', () => {
  it('returns a labelled href for an inquiry', () => {
    const a = primaryAction(n('connect.inquiry_received'));
    expect(a?.labelKey).toBe('actions.viewInquiries');
  });
  it('returns null for an unknown category', () => {
    expect(primaryAction(n('connect.unknown'))).toBeNull();
  });
  it('deep-links a post action to its entity', () => {
    const a = primaryAction(n('connect.post_commented', { entityId: 'p1' }));
    expect(a?.href).toBe('/connect/posts/p1');
    expect(a?.labelKey).toBe('actions.reply');
  });
});
