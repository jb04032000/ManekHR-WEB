import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, createEvent } from '@testing-library/react';
import DsButton from './DsButton';

/**
 * DsButton link mode (the accessibility contract).
 *
 * A CTA that navigates must be a single interactive element: an anchor styled
 * as the button. The old call-site convention wrapped a `<button>` in a Next
 * `<Link>`, producing a nested `<a><button>` (two tab stops, confusing screen
 * reader output, invalid HTML - WCAG 4.1.2 / 1.3.1). Passing `href` to
 * DsButton renders the styled control AS the anchor and intercepts the click
 * for client-side routing, so there is never a nested control.
 */
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  push.mockClear();
});

describe('DsButton', () => {
  it('renders a plain button when no href is given', () => {
    render(<DsButton onClick={() => {}}>Save</DsButton>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  describe('link mode (href)', () => {
    it('renders a single anchor carrying the href, with no nested button', () => {
      render(<DsButton href="/connect/marketplace/new">List your product</DsButton>);
      const link = screen.getByRole('link', { name: 'List your product' });
      expect(link).toHaveAttribute('href', '/connect/marketplace/new');
      // The whole point: one interactive element, not <a><button>.
      expect(link.querySelector('button')).toBeNull();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('navigates client-side on a plain left click (router.push + preventDefault)', () => {
      render(<DsButton href="/x">Go</DsButton>);
      const link = screen.getByRole('link', { name: 'Go' });
      const ev = createEvent.click(link, { button: 0 });
      fireEvent(link, ev);
      expect(push).toHaveBeenCalledWith('/x');
      // Default prevented => no full-page navigation, routing stays client-side.
      expect(ev.defaultPrevented).toBe(true);
    });

    it('lets modifier and middle clicks fall through to the browser (open in new tab)', () => {
      render(<DsButton href="/x">Go</DsButton>);
      const link = screen.getByRole('link', { name: 'Go' });

      const metaClick = createEvent.click(link, { button: 0, metaKey: true });
      fireEvent(link, metaClick);
      const middleClick = createEvent.click(link, { button: 1 });
      fireEvent(link, middleClick);

      expect(push).not.toHaveBeenCalled();
      expect(metaClick.defaultPrevented).toBe(false);
    });

    it('still fires a caller-supplied onClick before navigating', () => {
      const onClick = vi.fn();
      render(
        <DsButton href="/x" onClick={onClick}>
          Go
        </DsButton>,
      );
      fireEvent.click(screen.getByRole('link', { name: 'Go' }));
      expect(onClick).toHaveBeenCalledOnce();
      expect(push).toHaveBeenCalledWith('/x');
    });

    it('keeps dsVariant/dsSize styling on the anchor', () => {
      render(
        <DsButton href="/x" dsVariant="primary" dsSize="lg">
          Go
        </DsButton>,
      );
      // lg height (46px) comes from DsButton's own size map, applied inline.
      expect(screen.getByRole('link', { name: 'Go' })).toHaveStyle({ height: '46px' });
    });
  });
});
