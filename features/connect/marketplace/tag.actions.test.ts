import { describe, it, expect, vi, beforeEach } from 'vitest';
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
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
import { searchTags } from './tag.actions';
beforeEach(() => get.mockReset());
describe('searchTags', () => {
  it('maps the tag endpoint response to suggestions', async () => {
    get.mockResolvedValueOnce({ data: { tags: [{ slug: 'kanjivaram', label: 'Kanjivaram' }] } });
    const res = await searchTags('kanj');
    expect(get).toHaveBeenCalledWith('/connect/tags/search', { params: { q: 'kanj' } });
    expect(res).toEqual({ ok: true, data: [{ slug: 'kanjivaram', label: 'Kanjivaram' }] });
  });
  it('falls back to labels.en then slug for the label', async () => {
    get.mockResolvedValueOnce({
      data: { tags: [{ slug: 'zari', labels: { en: 'Zari' } }, { slug: 'moti' }] },
    });
    const res = await searchTags('z');
    expect(res).toEqual({
      ok: true,
      data: [
        { slug: 'zari', label: 'Zari' },
        { slug: 'moti', label: 'moti' },
      ],
    });
  });
});
