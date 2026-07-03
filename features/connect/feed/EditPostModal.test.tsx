import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App as AntApp } from 'antd';
import { fireEvent } from '@testing-library/react';
import { renderWithIntl, screen, waitFor } from '@/test-utils/render';
import type { HydratedFeedItem } from '@/features/connect/feed.types';

const editPost = vi.fn();
vi.mock('@/features/connect/feed.actions', () => ({
  editPost: (...a: unknown[]) => editPost(...a),
}));

import EditPostModal from './EditPostModal';

function makePost(over: Partial<HydratedFeedItem> = {}): HydratedFeedItem {
  return {
    _id: 'p1',
    authorId: 'a1',
    kind: 'text',
    body: 'Original body',
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
    author: { userId: 'a1', name: 'Meera', avatar: null, headline: null },
    ...over,
  };
}

function renderModal(post = makePost(), onSaved = vi.fn(), onCancel = vi.fn()) {
  return renderWithIntl(
    <AntApp>
      <EditPostModal open post={post} onSaved={onSaved} onCancel={onCancel} />
    </AntApp>,
  );
}

describe('EditPostModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    editPost.mockResolvedValue({
      ok: true,
      data: { post: { _id: 'p1', body: 'New body', editedAt: '2026-05-24T00:00:00.000Z' } },
    });
  });

  it('seeds the textarea with the current body', () => {
    renderModal(makePost({ body: 'Original body' }));
    expect(screen.getByDisplayValue('Original body')).toBeInTheDocument();
  });

  it('saves the edited body and reports the new body + editedAt back', async () => {
    const onSaved = vi.fn();
    renderModal(makePost({ body: 'Original body' }), onSaved);

    fireEvent.change(screen.getByDisplayValue('Original body'), {
      target: { value: 'New body' },
    });
    screen.getByRole('button', { name: /save changes/i }).click();

    await waitFor(() => {
      expect(editPost).toHaveBeenCalledWith('p1', { body: 'New body' });
    });
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith({
        body: 'New body',
        editedAt: '2026-05-24T00:00:00.000Z',
      });
    });
  });

  it('does not submit an unchanged body', () => {
    renderModal(makePost({ body: 'Original body' }));
    screen.getByRole('button', { name: /save changes/i }).click();
    expect(editPost).not.toHaveBeenCalled();
  });
});
