import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { renderWithIntl, screen, waitFor } from '@/test-utils/render';

const createPost = vi.fn();
vi.mock('@/features/connect/feed.actions', () => ({
  createPost: (...a: unknown[]) => createPost(...a),
}));

import Composer from './Composer';

function renderComposer(over: { onClose?: () => void; onPosted?: () => void } = {}) {
  return renderWithIntl(
    <AntApp>
      <Composer open onClose={over.onClose ?? (() => {})} onPosted={over.onPosted} />
    </AntApp>,
  );
}

describe('Composer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createPost.mockResolvedValue({ ok: true, data: { id: 'p1' } });
  });

  it('renders the composer sheet when open', () => {
    renderComposer();
    expect(screen.getByText('Create a post')).toBeInTheDocument();
  });

  it('keeps Publish disabled until there is something to post', () => {
    renderComposer();
    expect(screen.getByRole('button', { name: /publish/i })).toBeDisabled();
  });

  it('publishes a text post and reports it to the caller', async () => {
    const onPosted = vi.fn();
    renderComposer({ onPosted });

    fireEvent.change(screen.getByLabelText('Post text'), {
      target: { value: 'Finished a bridal order today.' },
    });
    screen.getByRole('button', { name: /publish/i }).click();

    await waitFor(() => {
      expect(createPost).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(onPosted).toHaveBeenCalled();
    });
    expect(createPost.mock.calls[0][0]).toMatchObject({
      kind: 'text',
      body: 'Finished a bridal order today.',
    });
  });
});
