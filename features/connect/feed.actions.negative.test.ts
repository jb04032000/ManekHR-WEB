import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Reader feed-feedback server actions (Phase 7d). Verifies the add/undo wire
 * shapes: the undo uses `DELETE /negative` with the same body as the add, so the
 * BE controller resolves the same row. The server HTTP boundary is mocked so the
 * action never touches `next/headers` cookies() (which throws outside a Server
 * Component) - mirrors ads.actions.test.ts.
 */
const { post, del } = vi.hoisted(() => ({ post: vi.fn(), del: vi.fn() }));
vi.mock('@/lib/api/server-client', () => ({
  serverHttp: vi.fn(async () => ({ post, delete: del })),
  unwrapServer: <T>(res: unknown): T => (res as { data?: T })?.data as T,
}));

import { addNegativeSignal, removeNegativeSignal } from './feed.actions';

beforeEach(() => {
  post.mockReset();
  del.mockReset();
});

describe('addNegativeSignal', () => {
  it('posts the kind + targetId to /me/connect/feed/negative', async () => {
    post.mockResolvedValueOnce({ data: { ok: true } });
    const res = await addNegativeSignal('not_interested', 'p1');
    expect(post).toHaveBeenCalledWith('/me/connect/feed/negative', {
      kind: 'not_interested',
      targetId: 'p1',
    });
    expect(res.ok).toBe(true);
  });
});

describe('removeNegativeSignal (undo)', () => {
  it('DELETEs /me/connect/feed/negative with the kind + targetId in the body', async () => {
    del.mockResolvedValueOnce({ data: { ok: true } });
    const res = await removeNegativeSignal('hide_post', 'p1');
    expect(del).toHaveBeenCalledWith('/me/connect/feed/negative', {
      data: { kind: 'hide_post', targetId: 'p1' },
    });
    expect(res.ok).toBe(true);
  });

  it('returns an error result when the backend rejects the undo', async () => {
    del.mockRejectedValueOnce(new Error('boom'));
    const res = await removeNegativeSignal('mute_author', 'a1');
    expect(res).toEqual({ ok: false, error: 'boom' });
  });
});
