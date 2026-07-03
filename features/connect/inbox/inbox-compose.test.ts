import { describe, it, expect } from 'vitest';
import {
  appendOptimistic,
  appendOptimisticToTimeline,
  deriveKind,
  isPendingMessage,
  makeOptimisticMessage,
  maxAckedSeq,
  reconcileSent,
  removeOptimistic,
  removeOptimisticFromTimeline,
} from './inbox-compose';
import type { InboxMessage, PersonTimeline } from './inbox.types';

function msg(partial: Partial<InboxMessage>): InboxMessage {
  return {
    _id: 'm',
    threadId: 't1',
    senderUserId: 'u1',
    kind: 'text',
    seq: 1,
    body: 'hi',
    media: [],
    audioUrl: null,
    audioDurationSec: null,
    clientMsgId: '',
    createdAt: '2026-05-31T10:00:00.000Z',
    ...partial,
  };
}

const baseInput = {
  threadId: 't1',
  senderUserId: 'u1',
  clientMsgId: 'cmid-1',
  body: 'hello',
  createdAt: '2026-05-31T10:00:00.000Z',
};

describe('deriveKind', () => {
  it('is voice when an audio url is present', () => {
    expect(deriveKind({ audioUrl: 'a.webm' })).toBe('voice');
  });
  it('is photo when media is present (and no audio)', () => {
    expect(deriveKind({ media: [{ url: 'p.jpg' }] })).toBe('photo');
  });
  it('is text otherwise', () => {
    expect(deriveKind({})).toBe('text');
    expect(deriveKind({ media: [] })).toBe('text');
  });
});

describe('makeOptimisticMessage', () => {
  it('builds a pending text echo (seq 0, pending id, clientMsgId set)', () => {
    const m = makeOptimisticMessage(baseInput);
    expect(m.seq).toBe(0);
    expect(m._id).toBe('pending:cmid-1');
    expect(m.clientMsgId).toBe('cmid-1');
    expect(m.kind).toBe('text');
    expect(m.body).toBe('hello');
    expect(isPendingMessage(m)).toBe(true);
  });

  it('derives voice / photo kinds from the payload', () => {
    expect(makeOptimisticMessage({ ...baseInput, audioUrl: 'a.webm' }).kind).toBe('voice');
    expect(
      makeOptimisticMessage({
        ...baseInput,
        media: [
          { url: 'p.jpg', mime: 'image/jpeg', width: null, height: null, scanStatus: 'pending' },
        ],
      }).kind,
    ).toBe('photo');
  });
});

describe('appendOptimistic', () => {
  it('prepends the echo (cache is newest-first)', () => {
    const prev = [msg({ _id: 'a', seq: 3 })];
    const echo = makeOptimisticMessage(baseInput);
    const next = appendOptimistic(prev, echo);
    expect(next).toHaveLength(2);
    expect(next[0]._id).toBe('pending:cmid-1');
    expect(next[1]._id).toBe('a');
  });
  it('handles an empty / undefined cache', () => {
    expect(appendOptimistic(undefined, msg({ _id: 'x' }))).toHaveLength(1);
  });
});

describe('reconcileSent', () => {
  const echo = makeOptimisticMessage(baseInput);
  const serverRow = msg({ _id: 'server-1', seq: 5, clientMsgId: 'cmid-1', body: 'hello' });

  it('replaces the optimistic row in place by clientMsgId', () => {
    const next = reconcileSent([echo], serverRow);
    expect(next).toHaveLength(1);
    expect(next[0]._id).toBe('server-1');
    expect(next[0].seq).toBe(5);
    expect(isPendingMessage(next[0])).toBe(false);
  });

  it('de-dupes a realtime echo twin that landed BEFORE the response', () => {
    // The socket echo (no clientMsgId) arrived first and was prepended above the
    // optimistic row; reconciling must leave exactly one server row.
    const realtimeEcho = msg({ _id: 'server-1', seq: 5, clientMsgId: '' });
    const cache = [realtimeEcho, echo]; // newest-first: echo arrived first, then realtime on top
    const next = reconcileSent(cache, serverRow);
    expect(next).toHaveLength(1);
    expect(next[0]._id).toBe('server-1');
    expect(next.filter((m) => m._id === 'server-1')).toHaveLength(1);
  });

  it('preserves other messages and ordering', () => {
    const other = msg({ _id: 'other', seq: 6, senderUserId: 'u2' });
    const cache = [other, echo]; // a newer message from the other party sits on top
    const next = reconcileSent(cache, serverRow);
    expect(next.map((m) => m._id)).toEqual(['other', 'server-1']);
  });

  it('prepends the server row when no optimistic / echo exists', () => {
    const next = reconcileSent([msg({ _id: 'a', seq: 4 })], serverRow);
    expect(next.map((m) => m._id)).toEqual(['server-1', 'a']);
  });
});

describe('removeOptimistic', () => {
  it('drops the failed echo by clientMsgId', () => {
    const echo = makeOptimisticMessage(baseInput);
    const next = removeOptimistic([echo, msg({ _id: 'a' })], 'cmid-1');
    expect(next.map((m) => m._id)).toEqual(['a']);
  });
});

describe('appendOptimisticToTimeline', () => {
  const base: PersonTimeline = {
    party: { userId: 'u2', name: 'Meera', avatar: null, handle: null },
    items: [
      {
        type: 'message',
        threadId: 'dm',
        channelType: 'dm',
        createdAt: '2026-05-31T09:00:00.000Z',
        message: msg({ _id: 'old', seq: 4 }),
      },
    ],
    threads: [{ threadId: 'dm', channelType: 'dm', newestSeq: 4, otherLastReadSeq: 0 }],
  };

  it('appends the echo as a newest-last message item', () => {
    const echo = makeOptimisticMessage({ ...baseInput, threadId: 'dm' });
    const next = appendOptimisticToTimeline(base, echo);
    expect(next.items).toHaveLength(2);
    const last = next.items[1];
    expect(last.type).toBe('message');
    expect(last.type === 'message' && last.message._id).toBe('pending:cmid-1');
    expect(last.type === 'message' && isPendingMessage(last.message)).toBe(true);
  });

  it('does not mutate the input timeline', () => {
    const echo = makeOptimisticMessage({ ...baseInput, threadId: 'dm' });
    appendOptimisticToTimeline(base, echo);
    expect(base.items).toHaveLength(1);
  });
});

describe('removeOptimisticFromTimeline', () => {
  it('drops only the failed echo, keeping contexts and other messages', () => {
    const echo = makeOptimisticMessage({ ...baseInput, threadId: 'dm' });
    const timeline: PersonTimeline = {
      party: null,
      items: [
        {
          type: 'context',
          threadId: 'a1',
          channelType: 'application',
          contextEntityId: 'app1',
          createdAt: '2026-05-31T08:00:00.000Z',
          context: {
            kind: 'application',
            jobId: 'J1',
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
          createdAt: echo.createdAt,
          message: echo,
        },
      ],
      threads: [],
    };
    const next = removeOptimisticFromTimeline(timeline, 'cmid-1');
    expect(next.items).toHaveLength(1);
    expect(next.items[0].type).toBe('context');
  });
});

describe('maxAckedSeq', () => {
  it('ignores optimistic rows (seq 0) and returns the highest acked seq', () => {
    const echo = makeOptimisticMessage(baseInput); // seq 0
    expect(maxAckedSeq([echo, msg({ _id: 'a', seq: 7 }), msg({ _id: 'b', seq: 3 })])).toBe(7);
    expect(maxAckedSeq([echo])).toBe(0);
    expect(maxAckedSeq(undefined)).toBe(0);
  });
});
