import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CtaButton } from './CtaButton';

// Intercept the analytics sink (CtaButton -> trackEvent -> track).
const track = vi.fn();
vi.mock('@/lib/analytics', () => ({ track: (...args: unknown[]) => track(...args) }));

afterEach(cleanup);
beforeEach(() => track.mockClear());

describe('CtaButton', () => {
  it('fires marketing.cta_clicked with page + position on click', () => {
    render(
      <CtaButton href="/auth" page="home" position="hero">
        Join free
      </CtaButton>,
    );
    fireEvent.click(screen.getByText('Join free'));
    expect(track).toHaveBeenCalledWith('marketing.cta_clicked', { page: 'home', position: 'hero' });
  });

  it('renders an external link with the connect page slug', () => {
    render(
      <CtaButton href="https://wa.me/123" page="connect" position="band_shop">
        Chat
      </CtaButton>,
    );
    fireEvent.click(screen.getByText('Chat'));
    expect(track).toHaveBeenCalledWith('marketing.cta_clicked', {
      page: 'connect',
      position: 'band_shop',
    });
  });
});
