/**
 * BoostResultsCard -- unit tests (RTL + vitest).
 *
 * BoostResultsCard is the reusable card body now hosted by both the Boosts-list
 * drawer (BoostResultsDrawer) and the thin BoostResults page wrapper.
 *
 * BOOST-USER-CONTROLS-OFF (owner 2026-06-19): users can't pause/resume/cancel +
 * spend hidden from users; admin keeps control. The card is now READ-ONLY for the
 * user: no spend/budget lines and no Pause / Resume / Cancel controls. These tests
 * assert that read-only state. The earlier pause/resume/cancel + budget cases are
 * commented out (not deleted) so they can come back with the controls.
 *
 * Covered now:
 *   1. Renders the three metric values; shows NO Pause / Resume / Cancel button
 *      and NO "spent of total" / "left" budget line for an active boost.
 *
 * Mock strategy mirrors AdCard.test.tsx: next/navigation and antd are mocked
 * before the subject import.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import type { BoostResultsCardData } from './BoostResults';

// ---------------------------------------------------------------------------
// BOOST-USER-CONTROLS-OFF (owner 2026-06-19): users can't pause/resume/cancel +
// spend hidden from users; admin keeps control. Commented (not deleted) to
// re-enable later. The card no longer imports pauseBoost/resumeBoost/cancelBoost,
// so ads.actions does not need mocking for these cases.
// ---------------------------------------------------------------------------
// const pauseBoostMock = vi.fn();
// const resumeBoostMock = vi.fn();
// const cancelBoostMock = vi.fn();
//
// vi.mock('./ads.actions', () => ({
//   pauseBoost: (...args: unknown[]) => pauseBoostMock(...args),
//   resumeBoost: (...args: unknown[]) => resumeBoostMock(...args),
//   cancelBoost: (...args: unknown[]) => cancelBoostMock(...args),
// }));

// ---------------------------------------------------------------------------
// Mock: next/navigation router (the read-only card no longer routes on cancel,
// but useRouter may still be referenced; keep a light stub).
// ---------------------------------------------------------------------------
const refreshMock = vi.fn();
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock, push: pushMock }),
}));

// ---------------------------------------------------------------------------
// Mock: antd. The read-only card only renders <Alert> (taken-down banner); the
// App.useApp/Popconfirm stand-ins are commented out with the disabled controls.
// ---------------------------------------------------------------------------
// const messageSuccessMock = vi.fn();
// const messageErrorMock = vi.fn();
vi.mock('antd', () => ({
  // App: {
  //   useApp: () => ({ message: { success: messageSuccessMock, error: messageErrorMock } }),
  // },
  // BoostResultsCard renders an <Alert> for a taken-down boost; a light stand-in
  // keeps the render smoke focused on the read-only card.
  Alert: ({ title, description }: { title?: React.ReactNode; description?: React.ReactNode }) => (
    <div role="alert">
      {title}
      {description}
    </div>
  ),
  // Popconfirm stand-in is commented out with the disabled Cancel control.
  // Popconfirm: ({
  //   children,
  //   onConfirm,
  // }: {
  //   children: React.ReactNode;
  //   onConfirm?: () => void;
  // }) => (
  //   <>
  //     {children}
  //     <button type="button" data-testid="popconfirm-ok" onClick={() => onConfirm?.()}>
  //       confirm
  //     </button>
  //   </>
  // ),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const BOOST_ID = 'camp-1';

function activeData(overrides: Partial<BoostResultsCardData> = {}): BoostResultsCardData {
  return {
    status: 'active',
    spent: 250,
    left: 50,
    reach: 1200,
    views: 3400,
    clicks: 42,
    moderationReason: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Subject (after mocks are hoisted)
// ---------------------------------------------------------------------------
import { BoostResultsCard } from './BoostResults';

describe('BoostResultsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the three metric values and shows NO spend/budget line and NO pause/resume/cancel controls for an active boost', () => {
    renderWithIntl(<BoostResultsCard boostId={BOOST_ID} data={activeData()} />);

    // Engagement counts (Intl.NumberFormat en-IN grouping) still render.
    expect(screen.getByText('1,200')).toBeInTheDocument();
    expect(screen.getByText('3,400')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();

    // BOOST-USER-CONTROLS-OFF: spend/budget is hidden from the user (admin-only).
    expect(screen.queryByText(/spent of/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/₹50 left/)).not.toBeInTheDocument();

    // BOOST-USER-CONTROLS-OFF: no user pause / resume / cancel controls.
    expect(screen.queryByRole('button', { name: /pause/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resume/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
  });

  // BOOST-USER-CONTROLS-OFF (owner 2026-06-19): users can't pause/resume/cancel +
  // spend hidden from users; admin keeps control. The pause/resume/cancel + budget
  // cases below are commented out (not deleted) so they come back with the controls.
  //
  // it('pauses: calls pauseBoost, flips to paused, fires success toast + onChanged', async () => {
  //   pauseBoostMock.mockResolvedValue({ ok: true, data: { message: 'ok' } });
  //   const onChanged = vi.fn();
  //   renderWithIntl(<BoostResultsCard boostId={BOOST_ID} data={activeData()} onChanged={onChanged} />);
  //   fireEvent.click(screen.getByRole('button', { name: /pause/i }));
  //   await waitFor(() => {
  //     expect(pauseBoostMock).toHaveBeenCalledWith(BOOST_ID);
  //     expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();
  //     expect(messageSuccessMock).toHaveBeenCalledTimes(1);
  //     expect(onChanged).toHaveBeenCalledTimes(1);
  //   });
  // });
  //
  // it('rolls back to active and fires error toast when pause fails', async () => {
  //   pauseBoostMock.mockResolvedValue({ ok: false, error: 'boom' });
  //   renderWithIntl(<BoostResultsCard boostId={BOOST_ID} data={activeData()} />);
  //   fireEvent.click(screen.getByRole('button', { name: /pause/i }));
  //   await waitFor(() => {
  //     expect(messageErrorMock).toHaveBeenCalledTimes(1);
  //   });
  //   expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
  //   expect(screen.queryByRole('button', { name: /resume/i })).not.toBeInTheDocument();
  // });
  //
  // it('resumes: calls resumeBoost, flips to active, fires success toast', async () => {
  //   resumeBoostMock.mockResolvedValue({ ok: true, data: { message: 'ok' } });
  //   renderWithIntl(<BoostResultsCard boostId={BOOST_ID} data={activeData({ status: 'paused' })} />);
  //   fireEvent.click(screen.getByRole('button', { name: /resume/i }));
  //   await waitFor(() => {
  //     expect(resumeBoostMock).toHaveBeenCalledWith(BOOST_ID);
  //     expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
  //     expect(messageSuccessMock).toHaveBeenCalledTimes(1);
  //   });
  // });
  //
  // it('renders a Cancel boost control for an active boost', () => {
  //   renderWithIntl(<BoostResultsCard boostId={BOOST_ID} data={activeData()} />);
  //   expect(screen.getByRole('button', { name: /cancel boost/i })).toBeInTheDocument();
  // });
  //
  // it('cancels (drawer host): calls cancelBoost, fires success toast, fires onChanged + onClose', async () => {
  //   cancelBoostMock.mockResolvedValue({ ok: true, data: { message: 'ok' } });
  //   const onChanged = vi.fn();
  //   const onClose = vi.fn();
  //   renderWithIntl(
  //     <BoostResultsCard boostId={BOOST_ID} data={activeData()} onChanged={onChanged} onClose={onClose} />,
  //   );
  //   fireEvent.click(screen.getByTestId('popconfirm-ok'));
  //   await waitFor(() => {
  //     expect(cancelBoostMock).toHaveBeenCalledWith(BOOST_ID);
  //     expect(messageSuccessMock).toHaveBeenCalledTimes(1);
  //     expect(onChanged).toHaveBeenCalledTimes(1);
  //     expect(onClose).toHaveBeenCalledTimes(1);
  //   });
  //   expect(pushMock).not.toHaveBeenCalled();
  // });
  //
  // it('cancels (page wrapper, no callbacks): routes back to the hub', async () => {
  //   cancelBoostMock.mockResolvedValue({ ok: true, data: { message: 'ok' } });
  //   renderWithIntl(<BoostResultsCard boostId={BOOST_ID} data={activeData()} />);
  //   fireEvent.click(screen.getByTestId('popconfirm-ok'));
  //   await waitFor(() => {
  //     expect(cancelBoostMock).toHaveBeenCalledWith(BOOST_ID);
  //     expect(messageSuccessMock).toHaveBeenCalledTimes(1);
  //     expect(pushMock).toHaveBeenCalledWith('/connect/boosts');
  //   });
  // });
});
