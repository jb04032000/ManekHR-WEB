import { describe, it, expect } from 'vitest';
import { groupOf, tagKeyOf, primaryAction } from './notification-presentation';

// Routing for the @mention (tag) alert (connect.post_mentioned). Links: backend
// FeedService.notifyMentioned + CommentService mention dispatch.
const mention = (entityId?: string) =>
  ({ category: 'connect.post_mentioned', entityId, metadata: {} }) as never;

describe('connect.post_mentioned routing', () => {
  it('groups under the feed tab', () => {
    expect(groupOf(mention())).toBe('feed');
  });
  it('uses the mention tag key', () => {
    expect(tagKeyOf(mention())).toBe('mention');
  });
  it('deep-links to the tagging post when an entity id is present', () => {
    expect(primaryAction(mention('p1'))).toEqual({
      labelKey: 'actions.viewPost',
      href: '/connect/posts/p1',
    });
  });
  it('falls back to the feed when there is no entity id', () => {
    expect(primaryAction(mention())?.href).toBe('/connect/feed');
  });
});
