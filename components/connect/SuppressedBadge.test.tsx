import { describe, it, expect } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import { SuppressedBadge } from './SuppressedBadge';

describe('SuppressedBadge', () => {
  it('renders the localized "Hidden" label', () => {
    renderWithIntl(<SuppressedBadge />);
    expect(screen.getByText('Hidden')).toBeInTheDocument();
  });
});
