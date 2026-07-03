import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * S1.6.1 contract tests for the Connect search action layer.
 *
 * Two exports, two contracts:
 *
 *   1. `searchConnect(q)` is the legacy back-compat call used by
 *      `ConnectSearchBar` (the global typeahead). It hits the same
 *      `GET /connect/search` endpoint but returns only the `PersonResult[]`
 *      from the envelope's top-level `results` field, so the typeahead does
 *      not have to change when the federated envelope lands.
 *
 *   2. `searchConnectAll(input)` is the new federated call used by the
 *      `/connect/search` results page (S1.6.2 +). It forwards the full filter
 *      set (type, skills, district, openToWork) and returns the whole
 *      `SearchResponse` envelope (`results`, `type`, `query`, `groups`).
 *
 * Both go through the same private HTTP helper inside the action module so
 * there is no duplicated mapping logic. Both short-circuit on a blank query
 * (mirrors the backend) without issuing a round-trip. Both funnel axios /
 * network errors through `toError` and never throw to the caller.
 */

// The mock `get` is hoisted so the factory below can reference it without the
// vitest "factory referenced top-level binding" error.
const { get } = vi.hoisted(() => ({ get: vi.fn() }));

// Mock the server HTTP boundary so the action never touches `next/headers`
// `cookies()` (which would throw outside a Server Component context). We
// mirror the real `unwrapServer` shape extractor so envelope handling stays
// realistic. See `lib/api/server-client.ts`.
vi.mock('@/lib/api/server-client', () => ({
  serverHttp: vi.fn(async () => ({ get })),
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

import { getTrendingTags, searchConnect, searchConnectAll, searchTags } from './search.actions';
import type { ConnectTagView, PersonResult, SearchResponse, TrendingTag } from './search.types';

const dougie: PersonResult = {
  userId: 'u-dougie',
  name: 'Dougie',
  avatar: null,
  headline: 'Zari karigar, Surat',
};

const envelopeOf = (
  people: PersonResult[],
  overrides: Partial<SearchResponse> = {},
): SearchResponse => ({
  results: people,
  posts: overrides.posts ?? [],
  listings: overrides.listings ?? [],
  // searchConnectAll always normalizes listingsTotal + peopleTotal (defaults to
  // 0); the fixture must carry them so the deep-equal envelope assertion matches.
  listingsTotal: overrides.listingsTotal ?? 0,
  peopleTotal: overrides.peopleTotal ?? 0,
  postsTotal: overrides.postsTotal ?? 0,
  jobsTotal: overrides.jobsTotal ?? 0,
  storefrontsTotal: overrides.storefrontsTotal ?? 0,
  pagesTotal: overrides.pagesTotal ?? 0,
  jobs: overrides.jobs ?? [],
  // SRCH-VERT-1: searchConnectAll normalizes storefronts/pages to [] when the
  // backend omits them; the fixture must carry them for the deep-equal match.
  storefronts: overrides.storefronts ?? [],
  pages: overrides.pages ?? [],
  type: overrides.type ?? 'people',
  query: overrides.query ?? { raw: 'zari', text: 'zari', tags: [] },
  groups: overrides.groups ?? [{ type: 'people', results: people }],
});

beforeEach(() => {
  get.mockReset();
});

describe('searchConnect (legacy back-compat)', () => {
  it('short-circuits on a blank query with no round-trip', async () => {
    const res = await searchConnect('   ');
    expect(get).not.toHaveBeenCalled();
    expect(res).toEqual({ ok: true, data: [] });
  });

  it('issues GET /connect/search with just q and returns results[]', async () => {
    get.mockResolvedValueOnce({ data: { data: envelopeOf([dougie]) } });
    const res = await searchConnect('zari');
    expect(get).toHaveBeenCalledWith('/connect/search', {
      params: { q: 'zari' },
      paramsSerializer: { indexes: null },
    });
    expect(res).toEqual({ ok: true, data: [dougie] });
  });

  it('maps a network failure to ActionResult.error and never throws', async () => {
    get.mockRejectedValueOnce(new Error('network down'));
    const res = await searchConnect('zari');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('network down');
  });
});

describe('searchConnectAll (federated envelope)', () => {
  it('short-circuits on a blank query with a default empty envelope', async () => {
    const res = await searchConnectAll({ q: '   ' });
    expect(get).not.toHaveBeenCalled();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.results).toEqual([]);
      expect(res.data.type).toBe('all');
      expect(res.data.query).toEqual({ raw: '', text: '', tags: [] });
      expect(res.data.groups).toEqual([]);
    }
  });

  it('forwards q + type and returns the full federated envelope', async () => {
    const envelope = envelopeOf([dougie]);
    get.mockResolvedValueOnce({ data: { data: envelope } });
    const res = await searchConnectAll({ q: 'zari', type: 'people' });
    expect(get).toHaveBeenCalledWith('/connect/search', {
      params: { q: 'zari', type: 'people' },
      paramsSerializer: { indexes: null },
    });
    expect(res).toEqual({ ok: true, data: envelope });
  });

  it('forwards filters (skills, district, openToWork) on the params object', async () => {
    get.mockResolvedValueOnce({
      data: {
        data: envelopeOf([], {
          query: { raw: '#zardozi', text: 'zari', tags: ['zari'] },
        }),
      },
    });
    await searchConnectAll({
      q: '#zardozi',
      type: 'people',
      filters: { skills: ['zari', 'embroidery'], district: 'surat', openToWork: true },
    });
    expect(get).toHaveBeenCalledWith('/connect/search', {
      params: {
        q: '#zardozi',
        type: 'people',
        skills: ['zari', 'embroidery'],
        district: 'surat',
        openToWork: true,
      },
      paramsSerializer: { indexes: null },
    });
  });

  it('forwards the blended categoryIn set (services "all services" default)', async () => {
    // /connect/services with no type picked sends the whole service-category set
    // as categoryIn so the BE blends every service category into one result.
    get.mockResolvedValueOnce({ data: { data: envelopeOf([]) } });
    await searchConnectAll({
      q: '',
      type: 'listings',
      filters: { categoryIn: ['consulting', 'transport', 'dyeing'] },
    });
    expect(get).toHaveBeenCalledWith('/connect/search', {
      params: {
        q: '',
        type: 'listings',
        categoryIn: ['consulting', 'transport', 'dyeing'],
      },
      paramsSerializer: { indexes: null },
    });
  });

  it('treats a blank-q browse with only categoryIn as a real search (no short-circuit)', async () => {
    // The blended "all services" landing has no q and no single category, only
    // categoryIn - it must still hit the BE, not short-circuit to an empty envelope.
    get.mockResolvedValueOnce({ data: { data: envelopeOf([]) } });
    const res = await searchConnectAll({
      q: '   ',
      type: 'listings',
      filters: { categoryIn: ['consulting', 'transport'] },
    });
    expect(get).toHaveBeenCalledTimes(1);
    expect(res.ok).toBe(true);
  });

  it('omits categoryIn from the params when the blended set is empty', async () => {
    // An empty categoryIn must not be forwarded (an empty array would otherwise
    // serialize to nothing useful and trip the BE ArrayMaxSize/whitelist contract).
    get.mockResolvedValueOnce({ data: { data: envelopeOf([dougie]) } });
    await searchConnectAll({ q: 'zari', type: 'listings', filters: { categoryIn: [] } });
    expect(get).toHaveBeenCalledWith('/connect/search', {
      params: { q: 'zari', type: 'listings' },
      paramsSerializer: { indexes: null },
    });
  });

  it('tolerates a partial envelope (missing groups + query) defensively', async () => {
    // Staging caches might serve a pre-S1.5 response shape with only
    // `results`. The action must still return a well-formed envelope so the
    // screen does not crash on `query.tags.map(...)`.
    get.mockResolvedValueOnce({ data: { data: { results: [dougie] } } });
    const res = await searchConnectAll({ q: 'zari' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.results).toEqual([dougie]);
      expect(res.data.type).toBe('all');
      expect(res.data.query).toEqual({ raw: 'zari', text: 'zari', tags: [] });
      expect(res.data.groups).toEqual([]);
    }
  });

  it('maps a network failure to ActionResult.error and never throws', async () => {
    get.mockRejectedValueOnce(new Error('boom'));
    const res = await searchConnectAll({ q: 'zari' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('boom');
  });
});

describe('getTrendingTags', () => {
  const zariTag: TrendingTag = {
    slug: 'zari',
    labels: { en: 'Zari', gu: 'જરી' },
    category: 'generic',
    usageCount: 42,
    trendingScore: 7.3,
  };

  it('issues GET /connect/tags/trending and returns the tags array', async () => {
    get.mockResolvedValueOnce({ data: { data: { tags: [zariTag] } } });
    const res = await getTrendingTags();
    expect(get).toHaveBeenCalledWith('/connect/tags/trending');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toEqual([zariTag]);
  });

  it('returns an empty array when the backend has nothing trending yet', async () => {
    get.mockResolvedValueOnce({ data: { data: { tags: [] } } });
    const res = await getTrendingTags();
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toEqual([]);
  });

  it('tolerates a partial envelope with the tags field missing', async () => {
    // Defensive: a future BE refactor or a staging cache could ship `{}`.
    get.mockResolvedValueOnce({ data: { data: {} } });
    const res = await getTrendingTags();
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toEqual([]);
  });

  it('maps a network failure to ActionResult.error and never throws', async () => {
    get.mockRejectedValueOnce(new Error('trending boom'));
    const res = await getTrendingTags();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('trending boom');
  });
});

describe('searchTags', () => {
  const zariTag: ConnectTagView = {
    slug: 'zari',
    labels: { en: 'Zari', gu: 'જરી' },
    category: 'generic',
    usageCount: 42,
    trendingScore: 7.3,
  };
  const zardoziTag: ConnectTagView = {
    slug: 'zardozi',
    labels: { en: 'Zardozi' },
    category: 'generic',
    usageCount: 18,
    trendingScore: 4.1,
  };

  it('short-circuits a blank query with no round-trip', async () => {
    const res = await searchTags('   ');
    expect(get).not.toHaveBeenCalled();
    expect(res).toEqual({ ok: true, data: [] });
  });

  it('issues GET /connect/tags/search with the query and returns the tags', async () => {
    get.mockResolvedValueOnce({ data: { data: { tags: [zariTag, zardoziTag] } } });
    const res = await searchTags('za');
    expect(get).toHaveBeenCalledWith('/connect/tags/search', { params: { q: 'za' } });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toEqual([zariTag, zardoziTag]);
  });

  it('tolerates a partial envelope with the tags field missing', async () => {
    get.mockResolvedValueOnce({ data: { data: {} } });
    const res = await searchTags('za');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toEqual([]);
  });

  it('maps a network failure to ActionResult.error and never throws', async () => {
    get.mockRejectedValueOnce(new Error('tags boom'));
    const res = await searchTags('za');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('tags boom');
  });
});
