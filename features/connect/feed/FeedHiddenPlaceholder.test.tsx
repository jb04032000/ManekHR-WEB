import { describe, it, expect, vi } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import FeedHiddenPlaceholder from './FeedHiddenPlaceholder';

/**
 * The inline "Post hidden - Undo" placeholder (Phase 7d). Covers that it shows
 * the hidden label and that Undo fires its callback (FeedList wires the callback
 * to restore the card + lift the hide on the backend).
 */
describe('FeedHiddenPlaceholder', () => {
  it('renders the hidden label and an Undo affordance', () => {
    renderWithIntl(<FeedHiddenPlaceholder onUndo={() => {}} />);
    expect(screen.getByText('Post hidden')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  it('fires onUndo when Undo is clicked', () => {
    const onUndo = vi.fn();
    renderWithIntl(<FeedHiddenPlaceholder onUndo={onUndo} />);
    screen.getByRole('button', { name: 'Undo' }).click();
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});
