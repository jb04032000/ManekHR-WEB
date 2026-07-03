import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * M1.6.2 - buyer-facing marketplace action layer.
 *
 *   - `getPublicListing(id)` GETs the public listing detail (M1.2) and returns
 *     an `ActionResult<ListingDetail>`.
 *   - `sendInquiry(listingId, message)` POSTs the inquiry (M1.5) and returns a
 *     discriminated `SendInquiryResult`, mapping the backend error envelope to
 *     an `InquiryErrorCode` via `mapInquiryError`.
 *
 * The server HTTP boundary is mocked so the action never touches `next/headers`
 * `cookies()` (which throws outside a Server Component). Mirrors the
 * `search.actions.test.ts` pattern.
 */
const { get, post, patch, del } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));
vi.mock('@/lib/api/server-client', () => ({
  serverHttp: vi.fn(async () => ({ get, post, patch, delete: del })),
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

import {
  createListing,
  deleteListing,
  getMyListings,
  getPublicListing,
  getReceivedInquiries,
  getSentInquiries,
  pauseListing,
  publishListing,
  sendInquiry,
  updateListing,
} from './marketplace.actions';

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  patch.mockReset();
  del.mockReset();
});

describe('getPublicListing', () => {
  it('GETs the public listing endpoint and returns the listing', async () => {
    const listing = {
      _id: 'L1',
      ownerUserId: 'u1',
      title: 'Heavy zari saree work',
      description: 'desc',
      category: 'embroidery-zari',
      priceType: 'range',
      images: [],
    };
    get.mockResolvedValueOnce({ data: { data: listing } });
    const res = await getPublicListing('L1');
    expect(get).toHaveBeenCalledWith('/connect/marketplace/public/listings/L1');
    expect(res).toEqual({ ok: true, data: listing });
  });

  it('maps a failure to ActionResult.error and never throws', async () => {
    get.mockRejectedValueOnce(new Error('nope'));
    const res = await getPublicListing('L1');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('nope');
  });
});

describe('sendInquiry', () => {
  it('POSTs the inquiry with the message body and returns the inquiry', async () => {
    const inquiry = {
      _id: 'I1',
      listingId: 'L1',
      buyerUserId: 'b1',
      sellerUserId: 's1',
      message: 'Interested, will call.',
      status: 'sent',
    };
    post.mockResolvedValueOnce({ data: { data: inquiry } });
    const res = await sendInquiry('L1', 'Interested, will call.');
    expect(post).toHaveBeenCalledWith('/connect/marketplace/listings/L1/inquiries', {
      message: 'Interested, will call.',
    });
    expect(res).toEqual({ ok: true, data: inquiry });
  });

  it('maps the seller lead-cap 403 to the discriminated code', async () => {
    post.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 403,
        data: { code: 'CONNECT_SELLER_LEAD_CAP_REACHED', error: { message: 'full' } },
      },
      message: 'Request failed',
    });
    const res = await sendInquiry('L1', 'hi');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('CONNECT_SELLER_LEAD_CAP_REACHED');
  });
});

describe('createListing', () => {
  it('POSTs the create payload and returns the created listing', async () => {
    const listing = {
      _id: 'L9',
      ownerUserId: 'u1',
      title: 'New saree work',
      description: '',
      category: 'embroidery-zari',
      priceType: 'negotiable',
      images: [],
      status: 'pending_review',
      moderationStatus: 'pending',
    };
    post.mockResolvedValueOnce({ data: { data: listing } });
    const res = await createListing({ title: 'New saree work', category: 'embroidery-zari' });
    expect(post).toHaveBeenCalledWith('/connect/marketplace/listings', {
      title: 'New saree work',
      category: 'embroidery-zari',
    });
    expect(res).toEqual({ ok: true, data: listing });
  });

  it('maps the typed CONNECT_LIMIT_REACHED 403 to the discriminated code + limit detail', async () => {
    post.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 403,
        data: {
          code: 'CONNECT_LIMIT_REACHED',
          kind: 'listing',
          error: { message: 'You have used 25 of 25.' },
          limit: 25,
          used: 25,
        },
      },
      message: 'Request failed',
    });
    const res = await createListing({ title: 'x', category: 'weaving' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('CONNECT_LIMIT_REACHED');
      expect(res.limitReached).toEqual({ kind: 'listing', limit: 25, used: 25 });
    }
  });
});

describe('getMyListings', () => {
  it('GETs the owner listings endpoint and returns them', async () => {
    const listings = [{ _id: 'L1', title: 'A', status: 'active' }];
    get.mockResolvedValueOnce({ data: { data: listings } });
    const res = await getMyListings();
    expect(get).toHaveBeenCalledWith('/connect/marketplace/listings/mine');
    expect(res).toEqual({ ok: true, data: listings });
  });
});

describe('updateListing', () => {
  it('PATCHes the listing with the changed fields', async () => {
    const updated = { _id: 'L1', title: 'New title', status: 'pending_review' };
    patch.mockResolvedValueOnce({ data: { data: updated } });
    const res = await updateListing('L1', { title: 'New title' });
    expect(patch).toHaveBeenCalledWith('/connect/marketplace/listings/L1', { title: 'New title' });
    expect(res).toEqual({ ok: true, data: updated });
  });
});

describe('publishListing / pauseListing', () => {
  it('POSTs the publish endpoint with no body', async () => {
    post.mockResolvedValueOnce({ data: { data: { _id: 'L1', status: 'active' } } });
    const res = await publishListing('L1');
    expect(post).toHaveBeenCalledWith('/connect/marketplace/listings/L1/publish');
    expect(res.ok).toBe(true);
  });

  it('POSTs the pause endpoint with no body', async () => {
    post.mockResolvedValueOnce({ data: { data: { _id: 'L1', status: 'paused' } } });
    const res = await pauseListing('L1');
    expect(post).toHaveBeenCalledWith('/connect/marketplace/listings/L1/pause');
    expect(res.ok).toBe(true);
  });
});

describe('deleteListing', () => {
  it('DELETEs the listing and resolves ok', async () => {
    del.mockResolvedValueOnce({ data: { success: true } });
    const res = await deleteListing('L1');
    expect(del).toHaveBeenCalledWith('/connect/marketplace/listings/L1');
    expect(res.ok).toBe(true);
  });

  it('maps a delete failure to an error result', async () => {
    del.mockRejectedValueOnce(new Error('nope'));
    const res = await deleteListing('L1');
    expect(res.ok).toBe(false);
  });
});

describe('getSentInquiries / getReceivedInquiries', () => {
  it('GETs the buyer outbox endpoint (first page, no cursor)', async () => {
    const page = { items: [{ _id: 'I1', listingId: 'L1', status: 'sent' }], nextCursor: null };
    get.mockResolvedValueOnce({ data: { data: page } });
    const res = await getSentInquiries();
    expect(get).toHaveBeenCalledWith('/connect/marketplace/inquiries/mine/sent', { params: {} });
    expect(res).toEqual({ ok: true, data: page });
  });

  it('GETs the seller inbox endpoint and forwards the cursor for load-more', async () => {
    const page = {
      items: [{ _id: 'I2', listingId: 'L2', status: 'viewed' }],
      nextCursor: 'CUR2',
    };
    get.mockResolvedValueOnce({ data: { data: page } });
    const res = await getReceivedInquiries('CUR1');
    expect(get).toHaveBeenCalledWith('/connect/marketplace/inquiries/mine/received', {
      params: { cursor: 'CUR1' },
    });
    expect(res).toEqual({ ok: true, data: page });
  });
});
