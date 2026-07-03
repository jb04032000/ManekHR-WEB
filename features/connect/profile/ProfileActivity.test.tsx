import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';

/**
 * Verifies the Activity section's tab routing: the three tabs render, and the
 * `?activityTab=` URL param selects which panel mounts (the shell never
 * remounts - ModuleTabs is link-driven). The heavy list children are stubbed;
 * their own behaviour is covered in ActivityCommentList.test.
 */

let currentParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  usePathname: () => '/connect/profile',
  useSearchParams: () => currentParams,
}));

vi.mock('./ActivityPostList', () => ({
  default: ({ type }: { type: string }) => <div data-testid="post-list">{`post-list:${type}`}</div>,
}));
vi.mock('./ActivityCommentList', () => ({
  default: () => <div data-testid="comment-list">comment-list</div>,
}));

import ProfileActivity from './ProfileActivity';

describe('ProfileActivity', () => {
  beforeEach(() => {
    currentParams = new URLSearchParams();
  });

  it('renders the three activity tabs', () => {
    renderWithIntl(<ProfileActivity />);
    expect(screen.getByRole('tab', { name: /posts/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /comments/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /reactions/i })).toBeInTheDocument();
  });

  it('defaults to the Posts panel when no activityTab param is present', () => {
    renderWithIntl(<ProfileActivity />);
    expect(screen.getByTestId('post-list')).toHaveTextContent('post-list:posts');
  });

  it('renders the Reactions panel when activityTab=reactions', () => {
    currentParams = new URLSearchParams('activityTab=reactions');
    renderWithIntl(<ProfileActivity />);
    expect(screen.getByTestId('post-list')).toHaveTextContent('post-list:reactions');
  });

  it('renders the Comments panel when activityTab=comments', () => {
    currentParams = new URLSearchParams('activityTab=comments');
    renderWithIntl(<ProfileActivity />);
    expect(screen.getByTestId('comment-list')).toBeInTheDocument();
  });

  it('falls back to the Posts panel for an unknown activityTab', () => {
    currentParams = new URLSearchParams('activityTab=nonsense');
    renderWithIntl(<ProfileActivity />);
    expect(screen.getByTestId('post-list')).toHaveTextContent('post-list:posts');
  });
});
