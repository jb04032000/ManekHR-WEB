import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App as AntApp } from 'antd';
import { renderWithIntl, screen, fireEvent } from '@/test-utils/render';

// The dialog's primary "View plans" CTA routes via next/navigation useRouter;
// mock it so the push target is assertable and the component renders without an
// app-router context. vi.hoisted so `push` exists when the hoisted mock factory
// runs (a plain const would be out of scope at hoist time).
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { LimitReachedDialog } from './LimitReachedDialog';

// Spy on the analytics emit while keeping ConnectEvents real. The dialog fires
// connect.limit.reached on open - the upsell-demand signal we measure pre-pricing.
vi.mock('@/lib/analytics-events', async (orig) => {
  const actual = await orig<typeof import('@/lib/analytics-events')>();
  return { ...actual, trackEvent: vi.fn() };
});
import { trackEvent, ConnectEvents } from '@/lib/analytics-events';

describe('LimitReachedDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the localized title, body (used/limit/kind) and coming-soon line', () => {
    renderWithIntl(
      <AntApp>
        <LimitReachedDialog
          open
          info={{ kind: 'listing', limit: 25, used: 25 }}
          onClose={vi.fn()}
        />
      </AntApp>,
    );

    expect(screen.getByText('You have reached your limit')).toBeInTheDocument();
    // body interpolates used/limit + the localized kind noun ("products").
    expect(screen.getByText('You have used 25 of 25 products.')).toBeInTheDocument();
    expect(screen.getByText(/Higher limits are coming soon/)).toBeInTheDocument();
    // Now that there is a real plan page, the dialog leads with a "View plans"
    // CTA (honest path, not a fake instant-buy) alongside the "Got it" dismiss.
    expect(screen.getByRole('button', { name: 'View plans' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument();
  });

  it('routes to /account/subscription and closes when "View plans" is clicked', () => {
    const onClose = vi.fn();
    renderWithIntl(
      <AntApp>
        <LimitReachedDialog
          open
          info={{ kind: 'listing', limit: 25, used: 25 }}
          onClose={onClose}
        />
      </AntApp>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View plans' }));
    expect(onClose).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/account/subscription');
  });

  it('fires the connect.limit.reached event with kind + limit on open', () => {
    renderWithIntl(
      <AntApp>
        <LimitReachedDialog open info={{ kind: 'job', limit: 10, used: 10 }} onClose={vi.fn()} />
      </AntApp>,
    );

    expect(trackEvent).toHaveBeenCalledWith(ConnectEvents.limitReached, { kind: 'job', limit: 10 });
  });

  it('does not render or fire when closed', () => {
    renderWithIntl(
      <AntApp>
        <LimitReachedDialog
          open={false}
          info={{ kind: 'job', limit: 10, used: 10 }}
          onClose={vi.fn()}
        />
      </AntApp>,
    );
    expect(screen.queryByText('You have reached your limit')).not.toBeInTheDocument();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('calls onClose when "Got it" is clicked', () => {
    const onClose = vi.fn();
    renderWithIntl(
      <AntApp>
        <LimitReachedDialog
          open
          info={{ kind: 'storefront', limit: 1, used: 1 }}
          onClose={onClose}
        />
      </AntApp>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onClose).toHaveBeenCalled();
  });
});
