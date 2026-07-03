import { describe, it, expect } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import { UsageMeter } from './UsageMeter';

/**
 * Presentational meter spec: the three states the task calls out (unlimited,
 * normal, at-cap) plus the near-cap amber threshold. Colors are asserted via the
 * fill element's inline background (cr- tokens).
 */
function fillBg() {
  const fill = screen.queryByTestId('usage-meter-fill') as HTMLElement | null;
  return fill?.style.background ?? null;
}

describe('UsageMeter', () => {
  it('normal state: shows label, "used of limit", primary fill', () => {
    renderWithIntl(<UsageMeter kind="listing" used={12} limit={25} />);
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('12 of 25')).toBeInTheDocument();
    expect(fillBg()).toBe('var(--cr-primary)');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '12');
  });

  it('near-cap state (>=80%): amber fill', () => {
    renderWithIntl(<UsageMeter kind="job" used={8} limit={10} />);
    expect(screen.getByText('8 of 10')).toBeInTheDocument();
    expect(fillBg()).toBe('var(--cr-warning)');
  });

  it('at-cap state: red fill', () => {
    renderWithIntl(<UsageMeter kind="storefront" used={1} limit={1} />);
    expect(screen.getByText('1 of 1')).toBeInTheDocument();
    expect(fillBg()).toBe('var(--cr-error)');
  });

  it('unlimited state (-1): shows "Unlimited" and renders no fill bar', () => {
    renderWithIntl(<UsageMeter kind="company_page" used={9999} limit={-1} />);
    expect(screen.getByText('Company pages')).toBeInTheDocument();
    expect(screen.getByText('Unlimited')).toBeInTheDocument();
    expect(screen.queryByTestId('usage-meter-fill')).not.toBeInTheDocument();
    // The used count is still shown next to the tag.
    expect(screen.getByText('9999')).toBeInTheDocument();
    // Indeterminate: no numeric value on the progressbar.
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
  });

  it('near state shows the "Almost at your limit" nudge', () => {
    renderWithIntl(<UsageMeter kind="job" used={9} limit={10} />);
    expect(screen.getByText('Almost at your limit')).toBeInTheDocument();
  });

  it('the nudge fires at EXACTLY 80% (4 of 5)', () => {
    renderWithIntl(<UsageMeter kind="storefront" used={4} limit={5} />);
    expect(fillBg()).toBe('var(--cr-warning)');
    expect(screen.getByText('Almost at your limit')).toBeInTheDocument();
  });

  it('just under 80% is not near and shows no nudge', () => {
    renderWithIntl(<UsageMeter kind="storefront" used={3} limit={5} />);
    expect(fillBg()).toBe('var(--cr-primary)');
    expect(screen.queryByText('Almost at your limit')).not.toBeInTheDocument();
  });

  it('at-cap shows no nudge (the OverLimitBanner owns that message)', () => {
    renderWithIntl(<UsageMeter kind="listing" used={10} limit={10} />);
    expect(screen.queryByText('Almost at your limit')).not.toBeInTheDocument();
  });

  it('showHint=false suppresses the nudge even when near', () => {
    renderWithIntl(<UsageMeter kind="job" used={9} limit={10} showHint={false} />);
    expect(fillBg()).toBe('var(--cr-warning)');
    expect(screen.queryByText('Almost at your limit')).not.toBeInTheDocument();
  });

  it('exposes aria-valuetext on the progressbar', () => {
    renderWithIntl(<UsageMeter kind="listing" used={2} limit={10} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toContain('2 of 10');
  });
});
