import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, screen, waitFor, fireEvent } from '@/test-utils/render';
import type { BoostNudgeCandidate } from '@/features/connect/boost-nudges.types';

/**
 * BoostNudgeSlot: fetches the owner's nudge candidates, renders ONE calm card,
 * marks it shown once, deep-links Boost per kind, and dismisses. We mock the
 * server actions + spy trackEvent (keeping the real analytics catalog + i18n).
 */
const getBoostNudges = vi.fn();
const markBoostNudgeShown = vi.fn().mockResolvedValue({ ok: true, data: true });
const dismissBoostNudge = vi.fn().mockResolvedValue({ ok: true, data: true });
vi.mock('@/features/connect/boost-nudges.actions', () => ({
  getBoostNudges: () => getBoostNudges(),
  markBoostNudgeShown: () => markBoostNudgeShown(),
  dismissBoostNudge: (id: string, kind: string) => dismissBoostNudge(id, kind),
}));

const trackEvent = vi.fn();
vi.mock('@/lib/analytics-events', async (orig) => {
  const actual = await orig<typeof import('@/lib/analytics-events')>();
  return { ...actual, trackEvent: (...a: unknown[]) => trackEvent(...a) };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { BoostNudgeSlot, __resetBoostNudgeShownGuard } from './BoostNudgeSlot';
import { __resetBoostNudgesCache } from '@/features/connect/useBoostNudges';

function candidate(over: Partial<BoostNudgeCandidate> = {}): BoostNudgeCandidate {
  return {
    kind: 'listing',
    entityId: 'e1',
    name: 'Velvet roll',
    viewsWindow: 42,
    windowDays: 7,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetBoostNudgesCache();
  __resetBoostNudgeShownGuard();
  getBoostNudges.mockResolvedValue({ ok: true, data: [candidate()] });
});

describe('BoostNudgeSlot', () => {
  it('renders the card with the entity name and views, and marks shown once', async () => {
    const { container } = renderWithIntl(<BoostNudgeSlot kind="listing" />);
    // Name is bolded in its own <strong>, so match it directly; the views live
    // in the sibling text, so assert on the card's full text content.
    expect(await screen.findByText('Velvet roll')).toBeInTheDocument();
    expect(container.textContent).toContain('42 views this week');

    await waitFor(() => expect(markBoostNudgeShown).toHaveBeenCalledTimes(1));
    expect(trackEvent).toHaveBeenCalledWith('connect.boost.nudge_shown', { kind: 'listing' });
  });

  it('deep-links Boost to the composer route for the candidate kind', async () => {
    getBoostNudges.mockResolvedValue({
      ok: true,
      data: [candidate({ kind: 'job', entityId: 'j9', name: 'Loom operator' })],
    });
    renderWithIntl(<BoostNudgeSlot kind="job" />);
    const boost = await screen.findByRole('link', { name: /Boost/i });
    expect(boost).toHaveAttribute('href', '/connect/boost/job/j9');
  });

  it('dismiss fires analytics + the action and hides the card', async () => {
    renderWithIntl(<BoostNudgeSlot kind="listing" />);
    await screen.findByText(/Velvet roll/);

    fireEvent.click(screen.getByText('Not now'));

    expect(trackEvent).toHaveBeenCalledWith('connect.boost.nudge_dismissed', { kind: 'listing' });
    expect(dismissBoostNudge).toHaveBeenCalledWith('e1', 'listing');
    await waitFor(() => expect(screen.queryByText(/Velvet roll/)).toBeNull());
  });

  it('fires nudge_clicked on Boost activation', async () => {
    renderWithIntl(<BoostNudgeSlot kind="listing" />);
    const boost = await screen.findByRole('link', { name: /Boost/i });
    fireEvent.click(boost);
    expect(trackEvent).toHaveBeenCalledWith('connect.boost.nudge_clicked', { kind: 'listing' });
  });

  it('renders nothing when no candidate matches the surface kind', async () => {
    getBoostNudges.mockResolvedValue({ ok: true, data: [candidate({ kind: 'post' })] });
    const { container } = renderWithIntl(<BoostNudgeSlot kind="listing" />);
    await waitFor(() => expect(getBoostNudges).toHaveBeenCalled());
    expect(container.querySelector('section')).toBeNull();
    expect(markBoostNudgeShown).not.toHaveBeenCalled();
  });

  it('an unfiltered slot shows the top-ranked candidate (covers the profile surface)', async () => {
    getBoostNudges.mockResolvedValue({
      ok: true,
      data: [
        candidate({ kind: 'post', entityId: 'p1', name: 'Top post', viewsWindow: 90 }),
        candidate({ kind: 'listing', entityId: 'l1', name: 'Velvet roll', viewsWindow: 42 }),
      ],
    });
    renderWithIntl(<BoostNudgeSlot />);
    expect(await screen.findByText('Top post')).toBeInTheDocument();
  });
});
