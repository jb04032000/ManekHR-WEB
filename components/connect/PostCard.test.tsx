import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App as AntApp } from 'antd';
import { renderWithIntl, screen, waitFor } from '@/test-utils/render';
import type { HydratedFeedItem } from '@/features/connect/feed.types';

const reactToPost = vi.fn();
const unreactFromPost = vi.fn();
const savePost = vi.fn();
const unsavePost = vi.fn();
const addNegativeSignal = vi.fn();
const removeNegativeSignal = vi.fn();
vi.mock('@/features/connect/feed.actions', () => ({
  reactToPost: (...a: unknown[]) => reactToPost(...a),
  unreactFromPost: (...a: unknown[]) => unreactFromPost(...a),
  savePost: (...a: unknown[]) => savePost(...a),
  unsavePost: (...a: unknown[]) => unsavePost(...a),
  addNegativeSignal: (...a: unknown[]) => addNegativeSignal(...a),
  removeNegativeSignal: (...a: unknown[]) => removeNegativeSignal(...a),
  repostPost: vi.fn().mockResolvedValue({ ok: true, data: { post: {} } }),
  unrepostPost: vi.fn().mockResolvedValue({ ok: true, data: { reposted: false } }),
  editPost: vi.fn().mockResolvedValue({ ok: true, data: { post: { body: '', editedAt: null } } }),
  // usePostRealtime opens a socket whose auth callback mints a ticket; stub it
  // so the async socket-open does not throw after the test completes.
  getSocketTicket: () => Promise.resolve({ ok: true, data: { ticket: '' } }),
}));

// PostCard calls `useRouter().push` (onboarding gate). Stub the app-router so
// the component mounts under the test renderer.
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import PostCard from './PostCard';

/** A plain text post - override per test. */
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
    reactionCount: 3,
    commentCount: 1,
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

function renderCard(post: HydratedFeedItem) {
  return renderWithIntl(
    <AntApp>
      <PostCard post={post} viewerId="viewer-1" onboarded={true} />
    </AntApp>,
  );
}

describe('PostCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reactToPost.mockResolvedValue({ ok: true, data: { reacted: true, reactionCount: 4 } });
    unreactFromPost.mockResolvedValue({ ok: true, data: { reacted: false, reactionCount: 3 } });
    savePost.mockResolvedValue({ ok: true, data: { saved: true } });
    unsavePost.mockResolvedValue({ ok: true, data: { saved: false } });
    addNegativeSignal.mockResolvedValue({ ok: true, data: { ok: true } });
    removeNegativeSignal.mockResolvedValue({ ok: true, data: { ok: true } });
  });

  it('renders the author name and the post body', () => {
    renderCard(makePost());
    expect(screen.getByText('Meera Sharma')).toBeInTheDocument();
    expect(screen.getByText('A new bridal order finished today.')).toBeInTheDocument();
  });

  it('renders a page post AS the company page (name + Page badge + link to /company/[slug])', () => {
    renderCard(
      makePost({
        companyPageId: 'cp1',
        companyPage: {
          id: 'cp1',
          name: 'Rajesh Mehta Textiles',
          slug: 'rajesh-mehta-textiles',
          logo: '',
        },
      }),
    );
    // The page name replaces the person; the person name is not shown.
    expect(screen.getByText('Rajesh Mehta Textiles')).toBeInTheDocument();
    expect(screen.queryByText('Meera Sharma')).not.toBeInTheDocument();
    expect(screen.getByText('Page')).toBeInTheDocument();
    // The author block (avatar + name links) points at the in-app company view.
    for (const link of screen.getAllByRole('link', { name: 'Rajesh Mehta Textiles' })) {
      expect(link).toHaveAttribute('href', '/connect/company/rajesh-mehta-textiles');
    }
  });

  it('renders a photo grid for a photo post', () => {
    renderCard(
      makePost({
        kind: 'photo',
        media: [
          { url: 'a.jpg', type: 'image' },
          { url: 'b.jpg', type: 'image' },
        ],
      }),
    );
    expect(screen.getAllByRole('img').length).toBeGreaterThanOrEqual(2);
  });

  it('renders a slideshow carousel for a photo post when mediaLayout is carousel', () => {
    renderCard(
      makePost({
        kind: 'photo',
        mediaLayout: 'carousel',
        media: [
          { url: 'a.jpg', type: 'image' },
          { url: 'b.jpg', type: 'image' },
          { url: 'c.jpg', type: 'image' },
        ],
      }),
    );
    expect(screen.getByRole('region', { name: 'Photo slideshow' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next photo' })).toBeInTheDocument();
  });

  it('keeps the static grid (no carousel controls) when mediaLayout is grid', () => {
    renderCard(
      makePost({
        kind: 'photo',
        mediaLayout: 'grid',
        media: [
          { url: 'a.jpg', type: 'image' },
          { url: 'b.jpg', type: 'image' },
        ],
      }),
    );
    expect(screen.queryByRole('button', { name: 'Next photo' })).not.toBeInTheDocument();
  });

  it('renders an audio player + transcript for a voice post', () => {
    const { container } = renderCard(
      makePost({
        kind: 'voice',
        audio: { url: 'v.mp3', durationSec: 24, transcript: 'Salaam, kaam available hai.' },
      }),
    );
    expect(container.querySelector('audio')).not.toBeNull();
    expect(screen.getByText(/Salaam, kaam available hai\./)).toBeInTheDocument();
  });

  it('reacts optimistically and reconciles with the server count', async () => {
    renderCard(makePost({ reactionCount: 3, viewerReacted: false }));
    screen.getByRole('button', { name: /like this post/i }).click();

    await waitFor(() => {
      expect(reactToPost).toHaveBeenCalledWith('p1');
    });
    await waitFor(() => {
      expect(screen.getByText('4')).toBeInTheDocument();
    });
  });

  it('un-reacts a post the viewer had already reacted to', async () => {
    renderCard(makePost({ reactionCount: 3, viewerReacted: true }));
    screen.getByRole('button', { name: /like this post/i }).click();

    await waitFor(() => {
      expect(unreactFromPost).toHaveBeenCalledWith('p1');
    });
  });

  it('saves a post from the action row', async () => {
    renderCard(makePost({ viewerSaved: false }));
    screen.getByRole('button', { name: 'Save' }).click();

    await waitFor(() => {
      expect(savePost).toHaveBeenCalledWith('p1');
    });
  });

  it('un-saves a post the viewer had already saved', async () => {
    renderCard(makePost({ viewerSaved: true }));
    screen.getByRole('button', { name: 'Saved' }).click();

    await waitFor(() => {
      expect(unsavePost).toHaveBeenCalledWith('p1');
    });
  });

  it('shows the "edited" label when the post was edited', () => {
    renderCard(makePost({ editedAt: new Date().toISOString() }));
    expect(screen.getByText(/edited/i)).toBeInTheDocument();
  });

  it('offers Edit + Delete items in the overflow menu only to the author', async () => {
    // viewerId matches the post author -> Edit + Delete appear.
    renderWithIntl(
      <AntApp>
        <PostCard post={makePost({ authorId: 'a1' })} viewerId="a1" onboarded={true} />
      </AntApp>,
    );
    screen.getByRole('button', { name: /more options/i }).click();
    expect(await screen.findByText('Edit post')).toBeInTheDocument();
    expect(screen.getByText('Delete post')).toBeInTheDocument();
    // Viewer-side feed controls are meaningless on your own post -> hidden.
    expect(screen.queryByText('Not interested')).not.toBeInTheDocument();
    expect(screen.queryByText('Hide this post')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Mute /)).not.toBeInTheDocument();
  });

  it('hides the Edit + Delete items from a non-author viewer', async () => {
    renderCard(makePost({ authorId: 'a1' })); // viewerId is "viewer-1"
    screen.getByRole('button', { name: /more options/i }).click();
    await screen.findByText('Not interested'); // menu open
    expect(screen.queryByText('Edit post')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete post')).not.toBeInTheDocument();
  });

  // ── Reader feedback controls (Phase 7d) ────────────────────────────────────

  it('not-interested: notifies the list instantly (swap placeholder) AND records the signal', async () => {
    const onNegativeSignal = vi.fn();
    renderWithIntl(
      <AntApp>
        <PostCard
          post={makePost({ authorId: 'a1' })}
          viewerId="viewer-1"
          onboarded={true}
          onNegativeSignal={onNegativeSignal}
        />
      </AntApp>,
    );
    screen.getByRole('button', { name: /more options/i }).click();
    (await screen.findByText('Not interested')).click();
    // Optimistic: not-interested now hides the post, so the list is told to swap in
    // the placeholder before the await (mirrors Hide), then the signal is recorded.
    expect(onNegativeSignal).toHaveBeenCalledWith(
      'not_interested',
      expect.objectContaining({ _id: 'p1' }),
    );
    await waitFor(() => expect(addNegativeSignal).toHaveBeenCalledWith('not_interested', 'p1'));
  });

  it('hides a post: notifies the list instantly AND records the signal', async () => {
    const onNegativeSignal = vi.fn();
    renderWithIntl(
      <AntApp>
        <PostCard
          post={makePost({ authorId: 'a1' })}
          viewerId="viewer-1"
          onboarded={true}
          onNegativeSignal={onNegativeSignal}
        />
      </AntApp>,
    );
    screen.getByRole('button', { name: /more options/i }).click();
    (await screen.findByText('Hide this post')).click();
    // Optimistic: the list is told to swap in the placeholder before the await.
    expect(onNegativeSignal).toHaveBeenCalledWith(
      'hide_post',
      expect.objectContaining({ _id: 'p1' }),
    );
    await waitFor(() => expect(addNegativeSignal).toHaveBeenCalledWith('hide_post', 'p1'));
  });

  it('mutes an author only after a 30-day confirm', async () => {
    const onNegativeSignal = vi.fn();
    renderWithIntl(
      <AntApp>
        <PostCard
          post={makePost({ authorId: 'a1' })}
          viewerId="viewer-1"
          onboarded={true}
          onNegativeSignal={onNegativeSignal}
        />
      </AntApp>,
    );
    screen.getByRole('button', { name: /more options/i }).click();
    (await screen.findByText(/^Mute /)).click();
    // The confirm states the 30-day scope before anything is recorded.
    const ok = await screen.findByRole('button', { name: /Mute for 30 days/i });
    expect(addNegativeSignal).not.toHaveBeenCalled();
    ok.click();
    await waitFor(() => expect(addNegativeSignal).toHaveBeenCalledWith('mute_author', 'a1'));
    expect(onNegativeSignal).toHaveBeenCalledWith(
      'mute_author',
      expect.objectContaining({ _id: 'p1' }),
    );
  });

  it('a sponsored card shows ONLY "Hide" and fires onSponsoredHide with the campaign id', async () => {
    const onSponsoredHide = vi.fn();
    renderWithIntl(
      <AntApp>
        <PostCard
          post={makePost({ authorId: 'a1' })}
          viewerId="viewer-1"
          onboarded={true}
          sponsoredCampaignId="camp-1"
          onSponsoredHide={onSponsoredHide}
        />
      </AntApp>,
    );
    screen.getByRole('button', { name: /more options/i }).click();
    const hideAd = await screen.findByText('Hide this ad');
    // None of the feed controls appear on a sponsored card.
    expect(screen.queryByText('Not interested')).not.toBeInTheDocument();
    expect(screen.queryByText('Hide this post')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Mute /)).not.toBeInTheDocument();
    hideAd.click();
    expect(onSponsoredHide).toHaveBeenCalledWith('camp-1');
  });

  // ── Boost CTA (author-only, public-gated) ──────────────────────────────────

  /** Render with the viewer AS the post author so the author-only menu shows. */
  function renderOwnCard(post: HydratedFeedItem) {
    return renderWithIntl(
      <AntApp>
        <PostCard post={post} viewerId="a1" onboarded={true} />
      </AntApp>,
    );
  }

  it('shows a Boost item on the author’s own PUBLIC post and navigates to the composer', async () => {
    renderOwnCard(makePost({ authorId: 'a1', visibility: 'public' }));
    screen.getByRole('button', { name: /more options/i }).click();
    const boost = await screen.findByText('Boost post', { selector: 'span' });
    // The menu item is enabled (not aria-disabled) on a public post.
    const item = boost.closest('[role="menuitem"]');
    expect(item).not.toBeNull();
    expect(item).not.toHaveClass('ant-dropdown-menu-item-disabled');
    boost.click();
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/connect/boost/post/p1');
    });
  });

  it('shows the Boost item DISABLED (with hint) on the author’s own non-public post', async () => {
    renderOwnCard(makePost({ authorId: 'a1', visibility: 'connections' as never }));
    screen.getByRole('button', { name: /more options/i }).click();
    const boost = await screen.findByText('Boost post', { selector: 'span' });
    const item = boost.closest('[role="menuitem"]');
    expect(item).toHaveClass('ant-dropdown-menu-item-disabled');
    // Clicking a disabled item must NOT navigate.
    boost.click();
    expect(push).not.toHaveBeenCalledWith('/connect/boost/post/p1');
  });

  it('does NOT show the Boost item on another user’s post', async () => {
    renderCard(makePost({ authorId: 'a1', visibility: 'public' })); // viewerId "viewer-1"
    screen.getByRole('button', { name: /more options/i }).click();
    await screen.findByText('Not interested'); // menu open
    expect(screen.queryByText('Boost post')).not.toBeInTheDocument();
  });

  it('does NOT show the Boost item on a repost wrapper (canEdit excludes reposts)', async () => {
    renderOwnCard(makePost({ authorId: 'a1', visibility: 'public', repostOf: 'root-1' }));
    screen.getByRole('button', { name: /more options/i }).click();
    // The author's own repost still shows Delete, but Boost (and Edit) are hidden.
    await screen.findByText('Delete post');
    expect(screen.queryByText('Boost post')).not.toBeInTheDocument();
  });

  // ── View count (author-only, LinkedIn model) ───────────────────────────────

  it('shows the view count to the post author', () => {
    renderOwnCard(makePost({ authorId: 'a1', viewCount: 5 })); // viewer IS the author
    expect(screen.getByText('5 views')).toBeInTheDocument();
  });

  it('hides the view count from a non-author viewer', () => {
    renderCard(makePost({ authorId: 'a1', viewCount: 5 })); // viewerId "viewer-1" != author
    expect(screen.queryByText('5 views')).not.toBeInTheDocument();
  });
});
