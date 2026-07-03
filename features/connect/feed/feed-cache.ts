import type { InfiniteData } from '@tanstack/react-query';
import type { HydratedFeedItem, HydratedFeedPage } from '../feed.types';

/** The shape `useInfiniteQuery(['connect-feed', tab])` stores in its cache. */
export type FeedInfiniteData = InfiniteData<HydratedFeedPage>;

/**
 * Prepend a freshly-created post to the FIRST page of a cached feed so the
 * author sees it INSTANTLY - without a full `router.refresh()`, which does not
 * repaint an already-mounted `useInfiniteQuery` cache (the root cause of the
 * "my own post never showed up in my feed" bug).
 *
 * Idempotent: a no-op when the post is already present (e.g. a realtime echo
 * raced the optimistic insert) or when the cache is empty / not yet seeded.
 * Pure - returns a new object, never mutates `old`.
 */
export function prependToFeedCache(
  old: FeedInfiniteData | undefined,
  item: HydratedFeedItem,
): FeedInfiniteData | undefined {
  if (!old || old.pages.length === 0) return old;
  if (old.pages.some((page) => page.posts.some((p) => p._id === item._id))) return old;
  const [first, ...rest] = old.pages;
  return { ...old, pages: [{ ...first, posts: [item, ...first.posts] }, ...rest] };
}

/**
 * Drop every post matching `shouldRemove` from a cached feed - backs the
 * negative-signal menu so a hidden post (or every post by a muted author)
 * disappears from the live list INSTANTLY, instead of lingering until the
 * server re-filters it on the next page fetch.
 *
 * Pure - returns a new object, never mutates `old`; a no-op when the cache is
 * empty / not yet seeded.
 */
export function removeFromFeedCache(
  old: FeedInfiniteData | undefined,
  shouldRemove: (post: HydratedFeedItem) => boolean,
): FeedInfiniteData | undefined {
  if (!old) return old;
  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      posts: page.posts.filter((post) => !shouldRemove(post)),
    })),
  };
}
