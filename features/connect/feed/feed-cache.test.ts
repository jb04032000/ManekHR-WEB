import { describe, it, expect } from 'vitest';
import { prependToFeedCache, removeFromFeedCache, type FeedInfiniteData } from './feed-cache';
import type { HydratedFeedItem } from '../feed.types';

function item(id: string, authorId = 'author-1'): HydratedFeedItem {
  return {
    _id: id,
    authorId,
    kind: 'text',
    body: 'hello',
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
    author: { userId: 'author-1', name: 'Author', avatar: null, headline: null },
  };
}

function cache(ids: string[]): FeedInfiniteData {
  return {
    pages: [{ posts: ids.map((id) => item(id)), nextCursor: null, caughtUp: true }],
    pageParams: [undefined],
  };
}

describe('prependToFeedCache', () => {
  it('prepends a freshly-created post to the first page (instant own-post visibility)', () => {
    const next = prependToFeedCache(cache(['p1', 'p0']), item('p2'));
    expect(next?.pages[0].posts.map((p) => p._id)).toEqual(['p2', 'p1', 'p0']);
  });

  it('is a no-op when the post is already present (realtime echo)', () => {
    const seeded = cache(['p1']);
    const next = prependToFeedCache(seeded, item('p1'));
    expect(next?.pages[0].posts.map((p) => p._id)).toEqual(['p1']);
  });

  it('leaves an unseeded / empty cache untouched', () => {
    expect(prependToFeedCache(undefined, item('p2'))).toBeUndefined();
    const empty: FeedInfiniteData = { pages: [], pageParams: [] };
    expect(prependToFeedCache(empty, item('p2'))).toBe(empty);
  });

  it('does not mutate the original cache object', () => {
    const seeded = cache(['p1']);
    prependToFeedCache(seeded, item('p2'));
    expect(seeded.pages[0].posts.map((p) => p._id)).toEqual(['p1']);
  });
});

describe('removeFromFeedCache', () => {
  /** Two pages, mixed authors - exercises cross-page filtering. */
  function mixed(): FeedInfiniteData {
    return {
      pages: [
        {
          posts: [item('p1', 'a'), item('p2', 'b'), item('p3', 'a')],
          nextCursor: 'c1',
          caughtUp: false,
        },
        { posts: [item('p4', 'b'), item('p5', 'a')], nextCursor: null, caughtUp: true },
      ],
      pageParams: [undefined, 'c1'],
    };
  }

  it('drops a single post by id (hide / not-interested)', () => {
    const next = removeFromFeedCache(mixed(), (p) => p._id === 'p2');
    expect(next?.pages.flatMap((pg) => pg.posts.map((p) => p._id))).toEqual([
      'p1',
      'p3',
      'p4',
      'p5',
    ]);
  });

  it('drops every post by a muted author across all pages', () => {
    const next = removeFromFeedCache(mixed(), (p) => p.authorId === 'a');
    expect(next?.pages.flatMap((pg) => pg.posts.map((p) => p._id))).toEqual(['p2', 'p4']);
  });

  it('preserves page cursors / caughtUp while pruning', () => {
    const next = removeFromFeedCache(mixed(), (p) => p._id === 'p1');
    expect(next?.pages[0].nextCursor).toBe('c1');
    expect(next?.pages[1].caughtUp).toBe(true);
  });

  it('leaves an unseeded cache untouched', () => {
    expect(removeFromFeedCache(undefined, () => true)).toBeUndefined();
  });

  it('does not mutate the original cache object', () => {
    const seeded = mixed();
    removeFromFeedCache(seeded, () => true);
    expect(seeded.pages[0].posts.map((p) => p._id)).toEqual(['p1', 'p2', 'p3']);
  });
});
