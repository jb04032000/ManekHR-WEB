import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithIntl, screen, waitFor } from '@/test-utils/render';
import type { HydratedActivityComment } from '../feed.types';

/**
 * Covers the Comments activity panel: the empty state, a listed comment linking
 * to its parent post, and the removed-parent note. The post-shaped tabs reuse
 * the feed `PostCard`, exercised in the feed tests.
 */

const getMyActivityComments = vi.fn();
vi.mock('../feed.actions', () => ({
  getMyActivityComments: (...a: unknown[]) => getMyActivityComments(...a),
}));

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import ActivityCommentList from './ActivityCommentList';

function comment(over: Partial<HydratedActivityComment> = {}): HydratedActivityComment {
  return {
    _id: 'c1',
    postId: 'p1',
    body: 'Beautiful work.',
    createdAt: new Date().toISOString(),
    post: {
      _id: 'p1',
      authorId: 'a1',
      kind: 'text',
      body: 'Finished a bridal order today.',
      media: [],
      audio: null,
      hashtags: [],
      tags: [],
      visibility: 'public',
      reactionCount: 0,
      commentCount: 1,
      viewCount: 0,
      repostCount: 0,
      authorErpLinked: false,
      authorSkills: [],
      createdAt: new Date().toISOString(),
      author: { userId: 'a1', name: 'Meera Shah', avatar: null, headline: null },
    },
    ...over,
  };
}

function renderList() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderWithIntl(
    <QueryClientProvider client={queryClient}>
      <ActivityCommentList />
    </QueryClientProvider>,
  );
}

describe('ActivityCommentList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMyActivityComments.mockResolvedValue({
      ok: true,
      data: { comments: [], nextCursor: null, caughtUp: true },
    });
  });

  it('shows the empty state when there are no comments', async () => {
    renderList();
    await waitFor(() => expect(screen.getByText(/no comments yet/i)).toBeInTheDocument());
  });

  it('lists a comment with a link to its parent post', async () => {
    getMyActivityComments.mockResolvedValue({
      ok: true,
      data: { comments: [comment()], nextCursor: null, caughtUp: true },
    });
    renderList();
    await waitFor(() => expect(screen.getByText('Beautiful work.')).toBeInTheDocument());
    expect(screen.getByText(/commented on meera shah's post/i)).toBeInTheDocument();
  });

  it('notes when the parent post was removed', async () => {
    getMyActivityComments.mockResolvedValue({
      ok: true,
      data: { comments: [comment({ post: null })], nextCursor: null, caughtUp: true },
    });
    renderList();
    await waitFor(() => expect(screen.getByText(/post that was removed/i)).toBeInTheDocument());
  });
});
