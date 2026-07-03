import { describe, it, expect } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import type { HydratedFeedItem } from '../feed.types';
import ActivityPreview from './ActivityPreview';

/**
 * The compact teaser: it links to the full activity route, renders recent post
 * snippets, and shows an honest empty hint (while still offering "Show all" so
 * the owner can reach their comments / reactions tabs).
 */

function post(over: Partial<HydratedFeedItem> = {}): HydratedFeedItem {
  return {
    _id: 'p1',
    authorId: 'me',
    kind: 'text',
    body: 'Finished a bridal order today',
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

describe('ActivityPreview', () => {
  it('links to the full activity route', () => {
    renderWithIntl(<ActivityPreview posts={[]} showAllHref="/connect/profile/activity" />);
    const link = screen.getByRole('link', { name: /show all activity/i });
    expect(link.getAttribute('href')).toBe('/connect/profile/activity');
  });

  it('renders recent post snippets', () => {
    renderWithIntl(<ActivityPreview posts={[post()]} showAllHref="/connect/profile/activity" />);
    expect(screen.getByText(/finished a bridal order/i)).toBeInTheDocument();
  });

  it('shows an empty hint when there are no posts', () => {
    renderWithIntl(<ActivityPreview posts={[]} showAllHref="/connect/profile/activity" />);
    expect(screen.getByText(/no posts yet/i)).toBeInTheDocument();
  });
});
