import { describe, it, expect } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import type { HydratedFeedItem } from '../feed.types';
import ActivityCard from './ActivityCard';

/**
 * Covers ActivityCard's photo teaser: a cropped grid that mirrors the feed's
 * PostPhotoGrid (up to 4 tiles, a "+N" overflow badge beyond that), with the
 * whole card linking through to the post (no lightbox here).
 */

function post(over: Partial<HydratedFeedItem> = {}): HydratedFeedItem {
  return {
    _id: 'p1',
    authorId: 'u1',
    kind: 'text',
    body: '',
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

function photos(n: number) {
  return Array.from({ length: n }, (_, i) => ({ url: `${i}.jpg`, type: 'image' as const }));
}

describe('ActivityCard photo teaser', () => {
  it('renders a single photo as one tile with no overflow badge', () => {
    renderWithIntl(<ActivityCard post={post({ kind: 'photo', media: photos(1) })} />);
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument();
  });

  it('renders up to four photos as four tiles with no overflow badge', () => {
    renderWithIntl(<ActivityCard post={post({ kind: 'photo', media: photos(4) })} />);
    expect(screen.getAllByRole('img')).toHaveLength(4);
    expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument();
  });

  it('caps at four tiles and shows a "+N" overflow badge beyond that', () => {
    renderWithIntl(<ActivityCard post={post({ kind: 'photo', media: photos(7) })} />);
    expect(screen.getAllByRole('img')).toHaveLength(4);
    expect(screen.getByText('+3')).toBeInTheDocument();
  });

  it('links the whole card through to the post', () => {
    renderWithIntl(<ActivityCard post={post({ _id: 'abc', kind: 'photo', media: photos(2) })} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/connect/posts/abc');
  });
});
