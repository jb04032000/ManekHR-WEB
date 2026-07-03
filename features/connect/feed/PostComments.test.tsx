import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithIntl, screen, waitFor } from '@/test-utils/render';
import type { HydratedComment, HydratedCommentsPage } from '../feed.types';

const listComments = vi.fn();
const addComment = vi.fn();
const deleteComment = vi.fn();
vi.mock('../feed.actions', () => ({
  listComments: (...a: unknown[]) => listComments(...a),
  addComment: (...a: unknown[]) => addComment(...a),
  deleteComment: (...a: unknown[]) => deleteComment(...a),
}));

// PostComments calls `useRouter().push` (onboarding gate). Stub the app-router.
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import PostComments from './PostComments';

function comment(over: Partial<HydratedComment> = {}): HydratedComment {
  return {
    _id: 'c1',
    postId: 'p1',
    authorId: 'other-user',
    body: 'Beautiful work.',
    parentId: null,
    createdAt: new Date().toISOString(),
    author: { userId: 'other-user', name: 'Anand Patel', avatar: null, headline: null },
    ...over,
  };
}

/** Wrap comments in the backend keyset envelope `listComments` now returns. */
function page(items: HydratedComment[], nextCursor: string | null = null): HydratedCommentsPage {
  return { items, nextCursor };
}

function renderThread(viewerId = 'me') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderWithIntl(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <PostComments postId="p1" viewerId={viewerId} onboarded={true} />
      </AntApp>
    </QueryClientProvider>,
  );
}

describe('PostComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listComments.mockResolvedValue({ ok: true, data: page([]) });
    addComment.mockResolvedValue({ ok: true, data: { id: 'c9' } });
    deleteComment.mockResolvedValue({ ok: true, data: { deleted: true } });
  });

  it('shows the empty state when there are no comments', async () => {
    renderThread();
    await waitFor(() => {
      expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
    });
  });

  it('lists existing comments', async () => {
    listComments.mockResolvedValue({ ok: true, data: page([comment()]) });
    renderThread();
    await waitFor(() => {
      expect(screen.getByText('Beautiful work.')).toBeInTheDocument();
    });
  });

  it('appends the next page when "View more comments" is clicked', async () => {
    // Page 1 has a cursor -> the load-more button shows; page 2 caps the thread.
    listComments
      .mockResolvedValueOnce({
        ok: true,
        data: page([comment({ _id: 'c1', body: 'First page.' })], 'CURSOR2'),
      })
      .mockResolvedValueOnce({
        ok: true,
        data: page([comment({ _id: 'c2', body: 'Second page.' })]),
      });
    renderThread();
    await waitFor(() => expect(screen.getByText('First page.')).toBeInTheDocument());

    const more = screen.getByRole('button', { name: /view more comments/i });
    more.click();

    await waitFor(() => expect(screen.getByText('Second page.')).toBeInTheDocument());
    // Page 1 stays rendered (appended, not replaced) and the cursor was forwarded.
    expect(screen.getByText('First page.')).toBeInTheDocument();
    expect(listComments).toHaveBeenNthCalledWith(2, 'p1', 'CURSOR2');
  });

  it('posts a new top-level comment', async () => {
    renderThread();
    const box = await screen.findByLabelText('Write a comment');
    fireEvent.change(box, { target: { value: 'Great finishing!' } });
    screen.getAllByRole('button', { name: /^post$/i })[0].click();

    await waitFor(() => {
      // Args now: (postId, body, parentId?, mentions?) - both optional trailing
      // args are undefined for a plain top-level comment with no @mentions.
      expect(addComment).toHaveBeenCalledWith('p1', 'Great finishing!', undefined, undefined);
    });
  });

  it('shows Delete only on the viewer own comment', async () => {
    listComments.mockResolvedValue({
      ok: true,
      data: page([comment({ _id: 'mine', authorId: 'me', body: 'My own comment.' })]),
    });
    renderThread('me');
    await waitFor(() => {
      expect(screen.getByText('My own comment.')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });
});
