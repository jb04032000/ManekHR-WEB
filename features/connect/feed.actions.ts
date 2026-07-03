'use server';

/**
 * Connect Feed - server actions (Phase 3). Call the backend `connect/feed`
 * endpoints through the httpOnly-cookie-authed `serverHttp` client. `getFeed`
 * additionally hydrates each post's author identity via the `connect/people`
 * batch lookup, so the feed UI renders without a second round-trip. Every
 * action returns a discriminated `ActionResult` - it never throws to the caller.
 */

import { isAxiosError } from 'axios';
import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { getPeople, getPublicPeople } from './network.actions';
import { getCompanyPageRefs } from './entities/company-page.actions';
import type { ActionResult } from './profile.types';
import type {
  ActivityCommentsPage,
  CompanyPageRef,
  CreatePostInput,
  EditPostInput,
  ErpSummary,
  FeedComment,
  FeedItem,
  FeedPost,
  FeedTab,
  HydratedActivityComment,
  HydratedActivityCommentsPage,
  HydratedComment,
  HydratedCommentsPage,
  HydratedFeedItem,
  HydratedFeedPage,
  NegativeSignalKind,
  ReactionResult,
} from './feed.types';

function toError(e: unknown): string {
  if (isAxiosError(e)) {
    const data = e.response?.data as { error?: { message?: string }; message?: string } | undefined;
    return data?.error?.message ?? data?.message ?? e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}

const BASE = '/me/connect/feed';

/** The raw (un-hydrated) feed page the backend returns. */
interface RawFeedPage {
  posts: FeedItem[];
  nextCursor: string | null;
  caughtUp: boolean;
}

/**
 * Batch-resolve the company-page identity for every page post in a set (incl.
 * reposts' embedded originals) in one round-trip - mirrors the `getPeople`
 * author batch. Returns an id→ref map; a personal post contributes nothing.
 */
async function resolvePageRefs(
  posts: Array<
    Pick<FeedPost, 'companyPageId'> & { original?: Pick<FeedPost, 'companyPageId'> | null }
  >,
): Promise<Map<string, CompanyPageRef>> {
  const ids = [
    ...new Set(
      posts.flatMap((p) =>
        [p.companyPageId, p.original?.companyPageId].filter((id): id is string => Boolean(id)),
      ),
    ),
  ];
  if (ids.length === 0) return new Map();
  const res = await getCompanyPageRefs(ids);
  return res.ok ? new Map(res.data.map((ref) => [ref.id, ref])) : new Map();
}

/**
 * One page of the caller's feed, authors hydrated. `cursor` is the previous
 * page's `nextCursor`; omit it for the first page.
 */
export async function getFeed(
  tab: FeedTab,
  cursor?: string,
): Promise<ActionResult<HydratedFeedPage>> {
  try {
    const http = await serverHttp();
    const res = await http.get(BASE, {
      params: { tab, ...(cursor ? { cursor } : {}) },
    });
    const page = unwrapServer<RawFeedPage>(res);

    // Resolve author identity for every post - AND every repost's embedded
    // original - in one batch round-trip.
    const authorIds = [
      ...new Set(
        page.posts.flatMap((p) => (p.original ? [p.authorId, p.original.authorId] : [p.authorId])),
      ),
    ];
    const [peopleRes, pageById] = await Promise.all([
      getPeople(authorIds),
      resolvePageRefs(page.posts),
    ]);
    const byId = peopleRes.ok
      ? new Map(peopleRes.data.map((person) => [person.userId, person]))
      : new Map();
    const pageRef = (id?: string | null) => (id ? (pageById.get(id) ?? null) : null);

    const posts: HydratedFeedItem[] = page.posts.map((post) => ({
      ...post,
      author: byId.get(post.authorId) ?? null,
      companyPage: pageRef(post.companyPageId),
      original: post.original
        ? {
            ...post.original,
            viewerReacted: false,
            viewerReposted: false,
            viewerSaved: false,
            author: byId.get(post.original.authorId) ?? null,
            companyPage: pageRef(post.original.companyPageId),
          }
        : null,
    }));
    return { ok: true, data: { posts, nextCursor: page.nextCursor, caughtUp: page.caughtUp } };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** A compact trending post for the feed right-rail "Trending in your trade" panel. */
export interface TrendingRailItem {
  postId: string;
  snippet: string;
  reactionCount: number;
}

/** Trending posts for the right rail - viewer-agnostic recent-popular public
 *  posts. Best-effort; the rail hides itself on error / empty. */
export async function getTrendingRail(): Promise<ActionResult<TrendingRailItem[]>> {
  try {
    const http = await serverHttp();
    // Fail-fast timeout (5s) instead of the shared 15s default: this is a
    // best-effort right-rail widget awaited inside the feed page's blocking
    // Promise.all (app/connect/feed/page.tsx), so a slow/cold-start backend on
    // THIS non-critical call would otherwise hold the whole feed render for the
    // full 15s before the rail hides. Capping it keeps the feed snappy; the rail
    // degrades to hidden on a timeout, which it already handles. Keep in sync
    // with the "best-effort rail" calls in the feed page's parallel load.
    const res = await http.get(`${BASE}/trending`, { timeout: 5000 });
    return { ok: true, data: unwrapServer<TrendingRailItem[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** React (`like`) to a post. Idempotent on the backend. */
export async function reactToPost(postId: string): Promise<ActionResult<ReactionResult>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/posts/${encodeURIComponent(postId)}/reactions`);
    return { ok: true, data: unwrapServer<ReactionResult>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Remove the caller's reaction from a post. */
export async function unreactFromPost(postId: string): Promise<ActionResult<ReactionResult>> {
  try {
    const http = await serverHttp();
    const res = await http.delete(`${BASE}/posts/${encodeURIComponent(postId)}/reactions`);
    return { ok: true, data: unwrapServer<ReactionResult>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * "Show me less" - record a negative signal (Phase 7c/7d). `hide_post` /
 * `not_interested` pass a post id; `mute_author` passes an author id. On the
 * backend: hide + an active mute HARD-EXCLUDE the viewer's feed in BOTH tabs;
 * not-interested only DAMPENS For-You scoring (the post stays, ranked lower).
 * Undo with `removeNegativeSignal`. Links: PostCard menu -> here -> BE feed
 * controller `/me/connect/feed/negative`.
 */
export async function addNegativeSignal(
  kind: NegativeSignalKind,
  targetId: string,
): Promise<ActionResult<{ ok: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/negative`, { kind, targetId });
    return { ok: true, data: unwrapServer<{ ok: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Undo a "show me less" signal (Phase 7d). Idempotent on the backend - undoing
 * one that was never set is a no-op. Backs the Undo affordance on every feedback
 * control (the hide placeholder, the not-interested / mute toasts).
 */
export async function removeNegativeSignal(
  kind: NegativeSignalKind,
  targetId: string,
): Promise<ActionResult<{ ok: boolean }>> {
  try {
    const http = await serverHttp();
    // The BE undo is `DELETE /negative` with the same body shape as the add.
    const res = await http.delete(`${BASE}/negative`, { data: { kind, targetId } });
    return { ok: true, data: unwrapServer<{ ok: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Record a viewport-impression batch - the posts that scrolled into the
 * viewer's view. Bumps each post's view count (first unique view) and marks
 * them seen for For-You discovery-suppression. Fire-and-forget telemetry: the
 * caller does not await or surface the result.
 */
export async function recordPostViews(
  postIds: string[],
): Promise<ActionResult<{ recorded: number }>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/views`, { postIds });
    return { ok: true, data: unwrapServer<{ recorded: number }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Repost a post. A bare repost (no `quote`) is idempotent - the backend returns
 * the existing one. A `quote` makes it a quote-repost (the quote is the new
 * post's body). Returns the created repost (fresh, so un-reacted).
 */
export async function repostPost(
  postId: string,
  quote?: string,
): Promise<ActionResult<{ post: FeedItem }>> {
  try {
    const http = await serverHttp();
    const res = await http.post(
      `${BASE}/posts/${encodeURIComponent(postId)}/repost`,
      quote ? { quote } : {},
    );
    const post = unwrapServer<FeedPost>(res);
    return {
      ok: true,
      data: { post: { ...post, viewerReacted: false, viewerReposted: true, viewerSaved: false } },
    };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Undo the caller's plain repost of a post. */
export async function unrepostPost(postId: string): Promise<ActionResult<{ reposted: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.delete(`${BASE}/posts/${encodeURIComponent(postId)}/repost`);
    return { ok: true, data: unwrapServer<{ reposted: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Save (bookmark) a post for the caller. Idempotent on the backend. */
export async function savePost(postId: string): Promise<ActionResult<{ saved: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/posts/${encodeURIComponent(postId)}/save`);
    return { ok: true, data: unwrapServer<{ saved: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Remove the caller's saved bookmark from a post. */
export async function unsavePost(postId: string): Promise<ActionResult<{ saved: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.delete(`${BASE}/posts/${encodeURIComponent(postId)}/save`);
    return { ok: true, data: unwrapServer<{ saved: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * One page of the caller's saved posts, newest-saved first, authors hydrated.
 * Mirrors `getFeed` (same hydration, no tab). `cursor` is the previous page's
 * `nextCursor`; omit it for the first page.
 */
export async function getSaved(cursor?: string): Promise<ActionResult<HydratedFeedPage>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/saved`, { params: cursor ? { cursor } : {} });
    const page = unwrapServer<RawFeedPage>(res);

    const authorIds = [
      ...new Set(
        page.posts.flatMap((p) => (p.original ? [p.authorId, p.original.authorId] : [p.authorId])),
      ),
    ];
    const [peopleRes, pageById] = await Promise.all([
      getPeople(authorIds),
      resolvePageRefs(page.posts),
    ]);
    const byId = peopleRes.ok
      ? new Map(peopleRes.data.map((person) => [person.userId, person]))
      : new Map();
    const pageRef = (id?: string | null) => (id ? (pageById.get(id) ?? null) : null);

    const posts: HydratedFeedItem[] = page.posts.map((post) => ({
      ...post,
      author: byId.get(post.authorId) ?? null,
      companyPage: pageRef(post.companyPageId),
      original: post.original
        ? {
            ...post.original,
            viewerReacted: false,
            viewerReposted: false,
            viewerSaved: false,
            author: byId.get(post.original.authorId) ?? null,
            companyPage: pageRef(post.original.companyPageId),
          }
        : null,
    }));
    return { ok: true, data: { posts, nextCursor: page.nextCursor, caughtUp: page.caughtUp } };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * One page of the caller's OWN activity - the post-shaped views (`posts` +
 * `reactions`) of the profile Activity tab. Authors hydrated exactly like
 * `getFeed`, so the same `PostCard` renders the rows. Comments are a different
 * shape - use `getMyActivityComments`.
 */
export async function getMyActivity(
  type: 'posts' | 'reactions',
  cursor?: string,
): Promise<ActionResult<HydratedFeedPage>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/activity`, {
      params: { type, ...(cursor ? { cursor } : {}) },
    });
    const page = unwrapServer<RawFeedPage>(res);

    const authorIds = [
      ...new Set(
        page.posts.flatMap((p) => (p.original ? [p.authorId, p.original.authorId] : [p.authorId])),
      ),
    ];
    const [peopleRes, pageById] = await Promise.all([
      getPeople(authorIds),
      resolvePageRefs(page.posts),
    ]);
    const byId = peopleRes.ok
      ? new Map(peopleRes.data.map((person) => [person.userId, person]))
      : new Map();
    const pageRef = (id?: string | null) => (id ? (pageById.get(id) ?? null) : null);

    const posts: HydratedFeedItem[] = page.posts.map((post) => ({
      ...post,
      author: byId.get(post.authorId) ?? null,
      companyPage: pageRef(post.companyPageId),
      original: post.original
        ? {
            ...post.original,
            viewerReacted: false,
            viewerReposted: false,
            viewerSaved: false,
            author: byId.get(post.original.authorId) ?? null,
            companyPage: pageRef(post.original.companyPageId),
          }
        : null,
    }));
    return { ok: true, data: { posts, nextCursor: page.nextCursor, caughtUp: page.caughtUp } };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * The raw public-activity page - the `@Public GET /connect/profiles/:slug/activity`
 * response. Posts carry NO viewer state (the viewer may be logged out), so they
 * are plain `FeedPost`s, each with an optional embedded repost `original`.
 */
interface RawPublicFeedPage {
  posts: Array<FeedPost & { original?: FeedPost | null }>;
  nextCursor: string | null;
  caughtUp: boolean;
}

/**
 * One page of a profile owner's PUBLIC posts - backs the Activity surface on
 * OTHER people's profiles (`/u/[slug]` teaser + the `/u/[slug]/activity` list).
 * Public read: works logged-out, posts only (comments + reactions stay
 * owner-only). Authors are hydrated exactly like `getMyActivity`; since a public
 * read carries no viewer state, each post is stamped `viewerReacted` /
 * `viewerReposted` / `viewerSaved` `false` so it satisfies the shared
 * `HydratedFeedItem` shape (the lightweight Activity rows never read those
 * flags). `cursor` is the previous page's `nextCursor`; omit it for page 1.
 */
export async function getPublicActivity(
  slug: string,
  cursor?: string,
): Promise<ActionResult<HydratedFeedPage>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`/connect/profiles/${encodeURIComponent(slug)}/activity`, {
      params: { type: 'posts', ...(cursor ? { cursor } : {}) },
    });
    const page = unwrapServer<RawPublicFeedPage>(res);

    const authorIds = [
      ...new Set(
        page.posts.flatMap((p) => (p.original ? [p.authorId, p.original.authorId] : [p.authorId])),
      ),
    ];
    // Public read: hydrate authors through the public-safe people lookup so a
    // logged-out visitor does not 401 on the members-only `/connect/people`.
    // Resolves only public-profile authors; a non-public repost original simply
    // resolves to no author. (Was `getPeople`, which is authed-only.)
    const peopleRes = await getPublicPeople(authorIds);
    const byId = peopleRes.ok
      ? new Map(peopleRes.data.map((person) => [person.userId, person]))
      : new Map();

    const posts: HydratedFeedItem[] = page.posts.map((post) => ({
      ...post,
      // Public read carries no viewer state (the viewer may be logged out).
      viewerReacted: false,
      viewerReposted: false,
      viewerSaved: false,
      author: byId.get(post.authorId) ?? null,
      original: post.original
        ? {
            ...post.original,
            viewerReacted: false,
            viewerReposted: false,
            viewerSaved: false,
            author: byId.get(post.original.authorId) ?? null,
          }
        : null,
    }));
    return { ok: true, data: { posts, nextCursor: page.nextCursor, caughtUp: page.caughtUp } };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * One page of a company page's PUBLIC posts (the page Posts tab + the public
 * `/company/[slug]` page). Hits `@Public GET connect/company-pages/:id/posts`.
 * Every post is attributed to the page, so the page identity is hydrated onto
 * each item; the person author is resolved too (for completeness). No viewer
 * state - the reader may be logged out.
 */
export async function getCompanyPagePosts(
  pageId: string,
  cursor?: string,
  opts?: { manage?: boolean },
): Promise<ActionResult<HydratedFeedPage>> {
  try {
    const http = await serverHttp();
    // The manage console is owner-authed and must see its own posts even while
    // the page is a hidden draft, so it hits the owner-gated `/manage/posts`
    // route; the public page keeps the `@Public()` `/posts` route.
    const path = opts?.manage
      ? `/connect/company-pages/${encodeURIComponent(pageId)}/manage/posts`
      : `/connect/company-pages/${encodeURIComponent(pageId)}/posts`;
    const res = await http.get(path, {
      params: cursor ? { cursor } : {},
    });
    const page = unwrapServer<RawPublicFeedPage>(res);

    const authorIds = [
      ...new Set(
        page.posts.flatMap((p) => (p.original ? [p.authorId, p.original.authorId] : [p.authorId])),
      ),
    ];
    const [peopleRes, pageById] = await Promise.all([
      getPeople(authorIds),
      resolvePageRefs(page.posts),
    ]);
    const byId = peopleRes.ok
      ? new Map(peopleRes.data.map((person) => [person.userId, person]))
      : new Map();
    const pageRef = (id?: string | null) => (id ? (pageById.get(id) ?? null) : null);

    const posts: HydratedFeedItem[] = page.posts.map((post) => ({
      ...post,
      viewerReacted: false,
      viewerReposted: false,
      viewerSaved: false,
      author: byId.get(post.authorId) ?? null,
      companyPage: pageRef(post.companyPageId),
      original: post.original
        ? {
            ...post.original,
            viewerReacted: false,
            viewerReposted: false,
            viewerSaved: false,
            author: byId.get(post.original.authorId) ?? null,
            companyPage: pageRef(post.original.companyPageId),
          }
        : null,
    }));
    return { ok: true, data: { posts, nextCursor: page.nextCursor, caughtUp: page.caughtUp } };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * One page of the caller's own comments (the Activity · Comments tab), each
 * with its parent post hydrated (author resolved) for context. Hits the same
 * `activity` endpoint with `type=comments`; the shape differs from a feed page.
 */
export async function getMyActivityComments(
  cursor?: string,
): Promise<ActionResult<HydratedActivityCommentsPage>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/activity`, {
      params: { type: 'comments', ...(cursor ? { cursor } : {}) },
    });
    const page = unwrapServer<ActivityCommentsPage>(res);

    // Resolve the author of each comment's parent post (skip deleted parents).
    const authorIds = [...new Set(page.comments.flatMap((c) => (c.post ? [c.post.authorId] : [])))];
    const peopleRes = authorIds.length
      ? await getPeople(authorIds)
      : ({ ok: true, data: [] } as const);
    const byId = peopleRes.ok
      ? new Map(peopleRes.data.map((person) => [person.userId, person]))
      : new Map();

    const comments: HydratedActivityComment[] = page.comments.map((c) => ({
      ...c,
      post: c.post ? { ...c.post, author: byId.get(c.post.authorId) ?? null } : null,
    }));
    return { ok: true, data: { comments, nextCursor: page.nextCursor, caughtUp: page.caughtUp } };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Create a feed post. Returns the FULL created post (the backend responds with
 * the post document) so the client can prepend it to the feed INSTANTLY - a
 * brand-new post is always un-reacted, so `viewerReacted` is false.
 */
export async function createPost(
  input: CreatePostInput,
): Promise<ActionResult<{ post: FeedItem }>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/posts`, input);
    const post = unwrapServer<FeedPost>(res);
    return {
      ok: true,
      data: { post: { ...post, viewerReacted: false, viewerReposted: false, viewerSaved: false } },
    };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Edit one of the caller's own posts (body / tags / visibility). Returns the
 * updated post so the card can reflect the new body + "edited" label without a
 * refetch. The viewer's own reaction / repost / save state is unchanged by an
 * edit, so the caller keeps its existing local state and only reads back the
 * edited fields.
 */
export async function editPost(
  postId: string,
  input: EditPostInput,
): Promise<ActionResult<{ post: FeedPost }>> {
  try {
    const http = await serverHttp();
    const res = await http.patch(`${BASE}/posts/${encodeURIComponent(postId)}`, input);
    return { ok: true, data: { post: unwrapServer<FeedPost>(res) } };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Delete one of the caller's own posts (author-only; the server soft-deletes,
 * so it leaves every feed). Returns the deleted flag; the caller prunes the
 * post from its list cache.
 */
export async function deletePost(postId: string): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.delete(`${BASE}/posts/${encodeURIComponent(postId)}`);
    return { ok: true, data: unwrapServer<{ deleted: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * A single PUBLIC post, author hydrated - backs the shareable post-detail
 * permalink (`/connect/posts/[id]` + the public `/p/[id]` mirror). Hits the
 * `@Public` `/connect/posts/:id` endpoint, so it resolves logged-out too.
 * `viewerReacted` is false (the public read carries no per-viewer state).
 */
export async function getPublicPost(postId: string): Promise<ActionResult<HydratedFeedItem>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`/connect/posts/${encodeURIComponent(postId)}`);
    const post = unwrapServer<FeedPost & { original?: FeedPost | null }>(res);
    const ids = post.original ? [post.authorId, post.original.authorId] : [post.authorId];
    // CN-FEED-16 (feed harden Bucket 7): resolve the company-page ref(s) too, so
    // a page-authored post seen via the new-post pill / own-post prepend renders
    // with the company's identity from the first paint. Every OTHER hydration
    // path in this file does this; getPublicPost was the one omission (it
    // rendered a page post as a personal post until a later refetch). Same
    // shared resolvePageRefs + pageRef shape as getFeed.
    const [peopleRes, pageById] = await Promise.all([
      getPeople([...new Set(ids)]),
      resolvePageRefs([post]),
    ]);
    const byId = peopleRes.ok
      ? new Map(peopleRes.data.map((person) => [person.userId, person]))
      : new Map();
    const pageRef = (id?: string | null) => (id ? (pageById.get(id) ?? null) : null);
    return {
      ok: true,
      data: {
        ...post,
        viewerReacted: false,
        viewerReposted: false,
        viewerSaved: false,
        author: byId.get(post.authorId) ?? null,
        companyPage: pageRef(post.companyPageId),
        original: post.original
          ? {
              ...post.original,
              viewerReacted: false,
              viewerReposted: false,
              viewerSaved: false,
              author: byId.get(post.original.authorId) ?? null,
              companyPage: pageRef(post.original.companyPageId),
            }
          : null,
      },
    };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** The raw (un-hydrated) comment page the backend returns. */
interface RawCommentsPage {
  items: FeedComment[];
  nextCursor: string | null;
}

/**
 * One page of a post's comment thread, comment authors hydrated. Top-level
 * comments are newest-first; each page carries its replies too (the UI regroups
 * `items` by `parentId`). `cursor` is the previous page's `nextCursor`; omit it
 * for the first page. Backs the "View more comments" load-more in PostComments.
 */
export async function listComments(
  postId: string,
  cursor?: string,
): Promise<ActionResult<HydratedCommentsPage>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/posts/${encodeURIComponent(postId)}/comments`, {
      params: cursor ? { cursor } : {},
    });
    const page = unwrapServer<RawCommentsPage>(res);
    const authorIds = [...new Set(page.items.map((c) => c.authorId))];
    const peopleRes = await getPeople(authorIds);
    const byId = peopleRes.ok
      ? new Map(peopleRes.data.map((person) => [person.userId, person]))
      : new Map();
    const items: HydratedComment[] = page.items.map((c) => ({
      ...c,
      author: byId.get(c.authorId) ?? null,
    }));
    return { ok: true, data: { items, nextCursor: page.nextCursor } };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Comment on a post, or reply (one level) to a top-level comment. `mentions`
 *  are the @-tags chosen in the comment composer; the backend resolves each into
 *  a stored Mention (href computed server-side). Omitted when none were tagged. */
export async function addComment(
  postId: string,
  body: string,
  parentId?: string,
  mentions?: { type: 'profile' | 'company' | 'storefront'; refId: string; display: string }[],
): Promise<ActionResult<{ id: string }>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/posts/${encodeURIComponent(postId)}/comments`, {
      body,
      ...(parentId ? { parentId } : {}),
      ...(mentions?.length ? { mentions } : {}),
    });
    const comment = unwrapServer<{ _id: string }>(res);
    return { ok: true, data: { id: String(comment._id) } };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Delete one of the caller's own comments. */
export async function deleteComment(
  commentId: string,
): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.delete(`${BASE}/comments/${encodeURIComponent(commentId)}`);
    return { ok: true, data: unwrapServer<{ deleted: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Mint a short-lived socket ticket for the realtime gateway. Runs server-side
 * (httpOnly cookie → Bearer), so the access token never reaches browser JS;
 * only the `connect-socket`-audience ticket does.
 */
export async function getSocketTicket(): Promise<ActionResult<{ ticket: string }>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/realtime/ticket`);
    return { ok: true, data: unwrapServer<{ ticket: string }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** The From-your-ERP callout summary for the caller. */
export async function getErpSummary(): Promise<ActionResult<ErpSummary>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/erp-summary`);
    return { ok: true, data: unwrapServer<ErpSummary>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
