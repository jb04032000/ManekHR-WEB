import { describe, it, expect, vi } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';

vi.mock('next/navigation', () => ({ usePathname: () => '/connect/feed' }));

import ConnectMobileTabBar from './ConnectMobileTabBar';

describe('ConnectMobileTabBar', () => {
  it('renders all five locked tabs', () => {
    renderWithIntl(<ConnectMobileTabBar />);
    for (const label of ['Home', 'Network', 'Market', 'Inbox', 'You']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('exposes the bar as a navigation landmark', () => {
    renderWithIntl(<ConnectMobileTabBar />);
    expect(screen.getByRole('navigation', { name: 'Connect' })).toBeInTheDocument();
  });
});
