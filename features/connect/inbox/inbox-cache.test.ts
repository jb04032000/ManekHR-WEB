import { describe, it, expect } from 'vitest';
import {
  appendMessage,
  mergeSince,
  bumpThread,
  clearThreadUnread,
  applyReadReceipt,
} from './inbox-cache';
import type { InboxMessage, InboxThread, PersonTimeline } from './inbox.types';

const msg = (over: Partial<InboxMessage>): InboxMessage => ({
  _id: 'm1',
  threadId: 't1',
  senderUserId: 'u1',
  kind: 'text',
  seq: 1,
  body: 'hi',
  media: [],
  audioUrl: null,
  audioDurationSec: null,
  clientMsgId: '',
  createdAt: '2026-05-31T00:00:00.000Z',
  ...over,
});

const thread = (over: Partial<InboxThread>): InboxThread => ({
  _id: 't1',
  channelType: 'dm',
  contextEntityType: null,
  contextEntityId: null,
  context: null,
  party: null,
  lastMessage: null,
  lastActivityAt: '2026-05-31T00:00:00.000Z',
  unreadCount: 0,
  archived: false,
  muted: false,
  closed: false,
  ...over,
});

describe('appendMessage', () => {
  it('prepends a new message (newest-first)', () => {
    const out = appendMessage([msg({ _id: 'a', seq: 1 })], msg({ _id: 'b', seq: 2 }));
    expect(out.map((m) => m._id)).toEqual(['b', 'a']);
  });

  it('dedups by _id (a reconnect replay does not double a line)', () => {
    const out = appendMessage([msg({ _id: 'a', seq: 1 })], msg({ _id: 'a', seq: 1 }));
    expect(out).toHaveLength(1);
  });

  it('reconciles an optimistic echo by clientMsgId (replaces the local row)', () => {
    const local = [msg({ _id: 'temp', clientMsgId: 'c1', seq: 0 })];
    const server = msg({ _id: 'real', clientMsgId: 'c1', seq: 5 });
    const out = appendMessage(local, server);
    expect(out).toHaveLength(1);
    expect(out[0]._id).toBe('real');
    expect(out[0].seq).toBe(5);
  });
});

describe('mergeSince', () => {
  it('merges a catch-up batch deduped, ordered newest-first by seq', () => {
    const out = mergeSince(
      [msg({ _id: 'a', seq: 1 })],
      [msg({ _id: 'b', seq: 2 }), msg({ _id: 'a', seq: 1 }), msg({ _id: 'c', seq: 3 })],
    );
    expect(out.map((m) => m._id)).toEqual(['c', 'b', 'a']);
  });
});

describe('bumpThread', () => {
  it('moves the thread to the top and applies the patch', () => {
    const list = [thread({ _id: 't1' }), thread({ _id: 't2' })];
    const out = bumpThread(list, 't2', { unreadCount: 3 });
    expect(out?.[0]._id).toBe('t2');
    expect(out?.[0].unreadCount).toBe(3);
  });

  it('is a no-op when the thread is not cached', () => {
    const list = [thread({ _id: 't1' })];
    expect(bumpThread(list, 'tX', { unreadCount: 1 })).toBe(list);
  });
});

describe('clearThreadUnread', () => {
  it('zeros the unread count of one thread', () => {
    const list = [thread({ _id: 't1', unreadCount: 5 }), thread({ _id: 't2', unreadCount: 2 })];
    const out = clearThreadUnread(list, 't1');
    expect(out?.find((t) => t._id === 't1')?.unreadCount).toBe(0);
    expect(out?.find((t) => t._id === 't2')?.unreadCount).toBe(2);
  });
});

describe('applyReadReceipt', () => {
  const timeline = (otherLastReadSeq: number): PersonTimeline => ({
    party: null,
    items: [],
    threads: [
      { threadId: 'dm', channelType: 'dm', newestSeq: 5, otherLastReadSeq },
      { threadId: 'other', channelType: 'dm', newestSeq: 9, otherLastReadSeq: 1 },
    ],
  });

  it('advances the matching thread watermark and leaves others alone', () => {
    const out = applyReadReceipt(timeline(2), 'dm', 5);
    expect(out?.threads.find((t) => t.threadId === 'dm')?.otherLastReadSeq).toBe(5);
    expect(out?.threads.find((t) => t.threadId === 'other')?.otherLastReadSeq).toBe(1);
  });

  it('is monotonic (never moves the watermark backwards)', () => {
    const out = applyReadReceipt(timeline(7), 'dm', 3);
    expect(out?.threads.find((t) => t.threadId === 'dm')?.otherLastReadSeq).toBe(7);
  });

  it('no-ops on an empty cache', () => {
    expect(applyReadReceipt(undefined, 'dm', 5)).toBeUndefined();
  });
});
