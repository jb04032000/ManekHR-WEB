import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithIntl, screen, waitFor, fireEvent } from '@/test-utils/render';
import type { HydratedFeedItem, HydratedFeedPage } from '../feed.types';

/**
 * Covers the public, visitor-facing activity list: it renders the server-seeded
 * first page without a client fetch, names the owner in the empty state, never
 * surfaces the owner-only Comments / Reactions tabs, and pages in more posts on
 * "Show more" up to the caught-up end.
 */

const getPublicActivity = vi.fn();
vi.mock('../feed.actions', () => ({
  getPublicActivity: (...a: unknown[]) => getPublicActivity(...a),
}));

import PublicActivityList from './PublicActivityList';

function post(over: Partial<HydratedFeedItem> = {}): HydratedFeedItem {
  return {
    _id: 'p1',
    authorId: 'u1',
    kind: 'text',
    body: 'Finished a bridal lehenga today',
    media: [],
    audio: null,
    hashtags: [],
    tags: [],
    visibility: 'public',
    reactionCount: 0,
    commentCount: 0,
    viewCount: 0,
    repostCount: 0,
    authorErpLinked: false,
    authorSkills: [],
    createdAt: new Date().toISOString(),
    viewerReacted: false,
    viewerReposted: false,
    viewerSaved: false,
    author: null,
    ...over,
  };
}

function page(over: Partial<HydratedFeedPage> = {}): HydratedFeedPage {
  return { posts: [], nextCursor: null, caughtUp: true, ...over };
}

function renderList(initialPage: HydratedFeedPage, name = 'Meera Shah') {
  // staleTime Infinity so the server-seeded initialData is not refetched on
  // mount (mirrors the production QueryProvider's 60s freshness).
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return renderWithIntl(
    <QueryClientProvider client={queryClient}>
      <PublicActivityList slug="meera-shah" name={name} initialPage={initialPage} />
    </QueryClientProvider>,
  );
}

describe('PublicActivityList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the server-seeded first page without a client fetch', () => {
    renderList(page({ posts: [post({ body: 'Finished a bridal lehenga today' })] }));
    expect(screen.getByText('Finished a bridal lehenga today')).toBeInTheDocument();
    expect(getPublicActivity).not.toHaveBeenCalled();
  });

  it('shows a visitor empty state naming the profile owner', () => {
    renderList(page({ posts: [] }), 'Meera Shah');
    expect(screen.getByText(/no posts yet/i)).toBeInTheDocument();
    expect(screen.getByText(/when meera shah shares posts/i)).toBeInTheDocument();
  });

  it('never surfaces the owner-only Comments / Reactions tabs', () => {
    renderList(page({ posts: [post()] }));
    expect(screen.queryByText('Comments')).not.toBeInTheDocument();
    expect(screen.queryByText('Reactions')).not.toBeInTheDocument();
  });

  it('pages in more posts on "Show more", then shows the caught-up end', async () => {
    getPublicActivity.mockResolvedValue({
      ok: true,
      data: page({ posts: [post({ _id: 'p2', body: 'Second page post' })] }),
    });
    renderList(
      page({
        posts: [post({ _id: 'p1', body: 'First page post' })],
        nextCursor: 'cursor-1',
        caughtUp: false,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: /show more/i }));

    await waitFor(() => expect(screen.getByText('Second page post')).toBeInTheDocument());
    expect(getPublicActivity).toHaveBeenCalledWith('meera-shah', 'cursor-1');
    expect(screen.getByText(/that is everything/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument();
  });

  it('keeps the loaded posts and offers a retry when "Show more" fails', async () => {
    getPublicActivity.mockResolvedValue({ ok: false, error: 'network down' });
    renderList(
      page({
        posts: [post({ _id: 'p1', body: 'First page post' })],
        nextCursor: 'cursor-1',
        caughtUp: false,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: /show more/i }));

    // The seeded post stays visible; a retry replaces the "Show more" button.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument(),
    );
    expect(screen.getByText('First page post')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument();
  });
});
