import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * decideAd (feed placement) - M2.2 hardening.
 *
 * The `/connect/ads/decide` response is generalized across surfaces: a win
 * carries `creativeKind` plus the matching ref (`postRef` for a promoted post,
 * `listingRef` for a promoted listing). The feed action must serve ONLY a
 * promoted_post win; a promoted_listing win (or any payload without a postRef)
 * must resolve to null so a listing can never leak into the feed render path
 * (which would otherwise produce a post fetch for `undefined`). This mirrors the
 * inverse guard already in `decideListingAd`.
 *
 * The server HTTP boundary is mocked so the action never touches `next/headers`
 * `cookies()` (which throws outside a Server Component). Mirrors the
 * `marketplace.actions.test.ts` pattern.
 */
const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/lib/api/server-client', () => ({
  serverHttp: vi.fn(async () => ({ post })),
  unwrapServer: <T>(res: unknown): T => {
    const body = (res as { data?: unknown })?.data;
    if (
      body &&
      typeof body === 'object' &&
      'data' in (body as Record<string, unknown>) &&
      (body as { data?: unknown }).data !== undefined
    ) {
      return (body as { data: T }).data;
    }
    return body as T;
  },
}));

import { decideAd, createPostBoost, hideSponsoredAd } from './ads.actions';
import type { PostBoostInput } from './ads.types';

beforeEach(() => {
  post.mockReset();
});

// cancelBoost (plus pauseBoost / resumeBoost) was removed: a user can no longer
// stop their own live boost (owner decision 2026-06-20). The backend dropped the
// matching routes, so there is no user action left to cover here. Admin take-down
// stays on its own path (ads-admin.actions.ts).

describe('hideSponsoredAd (Phase 7d)', () => {
  it('posts the campaign id to /connect/ads/hide', async () => {
    post.mockResolvedValueOnce(undefined); // BE returns 204 No Content
    const res = await hideSponsoredAd('camp-1');
    expect(post).toHaveBeenCalledWith('/connect/ads/hide', { campaignId: 'camp-1' });
    expect(res).toEqual({ ok: true, data: { ok: true } });
  });

  it('returns an error result when the backend rejects the hide', async () => {
    post.mockRejectedValueOnce(new Error('nope'));
    const res = await hideSponsoredAd('camp-1');
    expect(res).toEqual({ ok: false, error: 'nope' });
  });
});

describe('createPostBoost', () => {
  const input: PostBoostInput = {
    postId: 'post-1',
    objective: 'reach',
    totalBudget: 700,
    days: 7,
    targeting: { roles: [], sectors: [], districts: [], companySizes: [], maxConnectionDegree: 3 },
  };

  it('posts to /connect/ads/boosts/post and maps the campaign to BoostCreated', async () => {
    post.mockResolvedValueOnce({
      data: { data: { _id: 'camp-1', status: 'pending_review', objective: 'reach' } },
    });
    const res = await createPostBoost(input);
    expect(post).toHaveBeenCalledWith('/connect/ads/boosts/post', input);
    expect(res).toEqual({
      ok: true,
      data: { id: 'camp-1', status: 'pending_review', objective: 'reach' },
    });
  });

  it('returns an error result when the backend rejects the boost', async () => {
    post.mockRejectedValueOnce(new Error('Only the author can boost this post'));
    const res = await createPostBoost(input);
    expect(res).toEqual({ ok: false, error: 'Only the author can boost this post' });
  });
});

describe('decideAd (feed placement)', () => {
  it('returns the AdDecision for a promoted_post win', async () => {
    post.mockResolvedValueOnce({
      data: {
        data: {
          impressionToken: 'tok',
          postRef: 'p1',
          campaignId: 'c1',
          creativeKind: 'promoted_post',
        },
      },
    });
    const res = await decideAd('feed_promoted_post');
    expect(post).toHaveBeenCalledWith('/connect/ads/decide', {
      placementKey: 'feed_promoted_post',
    });
    expect(res).toEqual({
      ok: true,
      data: { impressionToken: 'tok', postRef: 'p1', campaignId: 'c1' },
    });
  });

  it('passes through a promoted_post win that omits creativeKind (backcompat)', async () => {
    post.mockResolvedValueOnce({
      data: { data: { impressionToken: 'tok', postRef: 'p1', campaignId: 'c1' } },
    });
    const res = await decideAd('feed_promoted_post');
    expect(res).toEqual({
      ok: true,
      data: { impressionToken: 'tok', postRef: 'p1', campaignId: 'c1' },
    });
  });

  it('rejects a promoted_listing win so a listing never renders in the feed', async () => {
    post.mockResolvedValueOnce({
      data: {
        data: {
          impressionToken: 'tok',
          listingRef: 'L1',
          campaignId: 'c1',
          creativeKind: 'promoted_listing',
        },
      },
    });
    const res = await decideAd('feed_promoted_post');
    expect(res).toEqual({ ok: true, data: null });
  });

  it('rejects a malformed win missing the postRef', async () => {
    post.mockResolvedValueOnce({
      data: { data: { impressionToken: 'tok', campaignId: 'c1' } },
    });
    const res = await decideAd('feed_promoted_post');
    expect(res).toEqual({ ok: true, data: null });
  });

  it('returns null on a no-fill', async () => {
    post.mockResolvedValueOnce({ data: { data: null } });
    const res = await decideAd('feed_promoted_post');
    expect(res).toEqual({ ok: true, data: null });
  });
});
