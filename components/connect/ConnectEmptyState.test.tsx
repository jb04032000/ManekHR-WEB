import { describe, it, expect, vi } from 'vitest';
import { Inbox } from 'lucide-react';
import { renderWithIntl, screen, fireEvent } from '@/test-utils/render';
import ConnectEmptyState from './ConnectEmptyState';

describe('ConnectEmptyState', () => {
  it('renders the headline and subhead', () => {
    renderWithIntl(
      <ConnectEmptyState icon={<Inbox />} title="No messages" description="Nothing yet." />,
    );
    expect(screen.getByText('No messages')).toBeInTheDocument();
    expect(screen.getByText('Nothing yet.')).toBeInTheDocument();
  });

  it('renders a primary action that links to its href', () => {
    renderWithIntl(
      <ConnectEmptyState
        icon={<Inbox />}
        title="t"
        description="d"
        primaryAction={{ label: 'Browse', href: '/x' }}
      />,
    );
    expect(screen.getByText('Browse').closest('a')).toHaveAttribute('href', '/x');
  });

  it('fires onClick for an action without an href', () => {
    const onClick = vi.fn();
    renderWithIntl(
      <ConnectEmptyState
        icon={<Inbox />}
        title="t"
        description="d"
        primaryAction={{ label: 'Go', onClick }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
