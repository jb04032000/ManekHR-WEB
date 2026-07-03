import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithIntl, screen, waitFor } from '@/test-utils/render';
import OnboardingClient from './OnboardingClient';
import { completeOnboarding } from '../profile.actions';

// `profile.actions` is `'use server'` (pulls in `next/headers`) - mock it.
vi.mock('../profile.actions', () => ({ completeOnboarding: vi.fn() }));

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

describe('OnboardingClient', () => {
  beforeEach(() => {
    push.mockClear();
    vi.mocked(completeOnboarding).mockReset();
  });

  it('renders the four intent cards', () => {
    renderWithIntl(<OnboardingClient />);
    expect(screen.getByText('I run a workshop')).toBeInTheDocument();
    expect(screen.getByText("I'm a karigar")).toBeInTheDocument();
    expect(screen.getByText('I buy embroidery work')).toBeInTheDocument();
    expect(screen.getByText('Just exploring')).toBeInTheDocument();
  });

  it('completes onboarding with the picked intent and routes to /connect', async () => {
    vi.mocked(completeOnboarding).mockResolvedValue({ ok: true, data: {} as never });
    const user = userEvent.setup();
    renderWithIntl(<OnboardingClient />);

    await user.click(screen.getByText("I'm a karigar"));

    await waitFor(() => expect(completeOnboarding).toHaveBeenCalledWith('karigar'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/connect/feed'));
  });

  it('stays on the page when the save fails', async () => {
    vi.mocked(completeOnboarding).mockResolvedValue({ ok: false, error: 'Network error' });
    const user = userEvent.setup();
    renderWithIntl(<OnboardingClient />);

    await user.click(screen.getByText('Just exploring'));

    await waitFor(() => expect(completeOnboarding).toHaveBeenCalledWith('explorer'));
    expect(push).not.toHaveBeenCalled();
  });
});
