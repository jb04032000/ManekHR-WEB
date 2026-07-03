import { describe, it, expect } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import PostResultCard from './PostResultCard';
import type { PostResult } from '../search.types';

/**
 * PostResultCard (search redesign Phase C) - the static post row in search
 * results. Links through to the post; never mounts a realtime socket. next/link
 * renders a plain <a> without a router, so no navigation mock is needed.
 */
const base: PostResult = {
  postId: 'p1',
  authorId: 'u-meera',
  author: {
    userId: 'u-meera',
    name: 'Meera Sharma',
    avatar: null,
    headline: 'Master zari karigar',
  },
  snippet: 'Heavy zari work on silk',
  kind: 'text',
  coverImage: null,
  reactionCount: 3,
  commentCount: 1,
  createdAt: '2026-05-30T10:00:00.000Z',
};

describe('PostResultCard', () => {
  it('renders the author, snippet, and links to the post detail', () => {
    renderWithIntl(<PostResultCard post={base} />);
    expect(screen.getByText('Meera Sharma')).toBeInTheDocument();
    expect(screen.getByText('Heavy zari work on silk')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Post by Meera Sharma' });
    expect(link.getAttribute('href')).toBe('/connect/posts/p1');
  });

  it('renders the cover image when the post has one', () => {
    const { container } = renderWithIntl(
      <PostResultCard post={{ ...base, kind: 'photo', coverImage: 'https://img.example/x.jpg' }} />,
    );
    expect(container.querySelector('img[src="https://img.example/x.jpg"]')).not.toBeNull();
  });

  it('shows no cover image for a text post', () => {
    const { container } = renderWithIntl(<PostResultCard post={base} />);
    // DsAvatar with no src renders initials (not an <img>), so a text post has none.
    expect(container.querySelector('img')).toBeNull();
  });
});
