import { describe, it, expect } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import type { HydratedFeedItem } from '@/features/connect/feed.types';
import PublicPostView from './PublicPostView';

/**
 * PublicPostView is the provider-free mirror used on the logged-out public
 * permalink and inside a repost embed. Under the author-only view-count model it
 * must never render a view count (no signed-in author context here). Keep in
 * sync with PostCard's author-gated chip.
 */
function makePost(over: Partial<HydratedFeedItem> = {}): HydratedFeedItem {
  return {
    _id: 'p1',
    authorId: 'a1',
    kind: 'text',
    body: 'A new bridal order finished today.',
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
    author: { userId: 'a1', name: 'Meera Sharma', avatar: null, headline: 'Master karigar' },
    ...over,
  };
}

describe('PublicPostView', () => {
  it('renders the post body', () => {
    renderWithIntl(<PublicPostView post={makePost({ body: 'Hello world' })} />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('never shows a view count (author-only model)', () => {
    renderWithIntl(<PublicPostView post={makePost({ viewCount: 9 })} />);
    expect(screen.queryByText(/9 views/)).not.toBeInTheDocument();
  });
});
