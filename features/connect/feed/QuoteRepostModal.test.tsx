import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { renderWithIntl, screen, waitFor } from '@/test-utils/render';
import type { HydratedFeedItem } from '@/features/connect/feed.types';

const repostPost = vi.fn();
vi.mock('@/features/connect/feed.actions', () => ({
  repostPost: (...a: unknown[]) => repostPost(...a),
}));

import QuoteRepostModal from './QuoteRepostModal';

/** A minimal hydrated original to quote. */
function original(): HydratedFeedItem {
  return {
    _id: 'orig1',
    authorId: 'a1',
    kind: 'text',
    body: 'Original post body',
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
    author: { userId: 'a1', name: 'Meera Sharma', avatar: null, headline: null },
  };
}

describe('QuoteRepostModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repostPost.mockResolvedValue({ ok: true, data: { post: {} } });
  });

  it('previews the quoted post and submits the quote-repost', async () => {
    const onPosted = vi.fn();
    renderWithIntl(
      <AntApp>
        <QuoteRepostModal open original={original()} onCancel={() => {}} onPosted={onPosted} />
      </AntApp>,
    );

    // The original is previewed (read-only) inside the modal.
    expect(screen.getByText('Original post body')).toBeInTheDocument();

    // Type a quote, then submit.
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'My take on this' } });
    screen.getByRole('button', { name: 'Repost' }).click();

    await waitFor(() => {
      expect(repostPost).toHaveBeenCalledWith('orig1', 'My take on this');
      expect(onPosted).toHaveBeenCalled();
    });
  });

  it('keeps the submit disabled until a non-empty quote is entered', () => {
    renderWithIntl(
      <AntApp>
        <QuoteRepostModal open original={original()} onCancel={() => {}} onPosted={() => {}} />
      </AntApp>,
    );
    expect(screen.getByRole('button', { name: 'Repost' })).toBeDisabled();
  });
});
