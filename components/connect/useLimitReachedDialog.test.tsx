import { describe, it, expect, vi } from 'vitest';
import { App as AntApp } from 'antd';
import { renderWithIntl, screen, fireEvent } from '@/test-utils/render';

// The dialog this hook renders now carries a "View plans" CTA that calls
// next/navigation useRouter; mock it so the dialog renders without an app-router
// context. vi.hoisted so the stub exists when the hoisted mock factory runs.
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { useLimitReachedDialog } from './useLimitReachedDialog';
import type { ConnectLimitInfo } from '@/features/connect/connect-limit';

/**
 * The hook is the single path all four Connect create flows use to turn a typed
 * CONNECT_LIMIT_REACHED result into the upgrade dialog. Testing it here covers
 * the shared per-flow error path (listing / storefront / company page / job)
 * without re-mounting each heavy composer.
 */

// Minimal harness mirroring how a create screen wires the hook: call handleLimited
// on the action result, render the returned dialog.
function Harness({
  result,
}: {
  result: { ok: false; limitReached?: ConnectLimitInfo } | { ok: true };
}) {
  const { dialog, handleLimited } = useLimitReachedDialog();
  return (
    <AntApp>
      <button onClick={() => handleLimited(result)}>create</button>
      {dialog}
    </AntApp>
  );
}

describe('useLimitReachedDialog', () => {
  it('opens the dialog when the result carries a plan-limit block', () => {
    renderWithIntl(
      <Harness result={{ ok: false, limitReached: { kind: 'storefront', limit: 1, used: 1 } }} />,
    );

    expect(screen.queryByText('You have reached your limit')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('create'));
    expect(screen.getByText('You have reached your limit')).toBeInTheDocument();
    expect(screen.getByText('You have used 1 of 1 storefronts.')).toBeInTheDocument();
  });

  it('does nothing for an ordinary (non-limit) failure', () => {
    renderWithIntl(<Harness result={{ ok: false }} />);
    fireEvent.click(screen.getByText('create'));
    expect(screen.queryByText('You have reached your limit')).not.toBeInTheDocument();
  });

  it('returns true only when a limit was handled', () => {
    const seen: boolean[] = [];
    function Probe() {
      const { handleLimited } = useLimitReachedDialog();
      return (
        <>
          <button
            onClick={() =>
              seen.push(
                handleLimited({ ok: false, limitReached: { kind: 'job', limit: 10, used: 10 } }),
              )
            }
          >
            limited
          </button>
          <button onClick={() => seen.push(handleLimited({ ok: false }))}>plain</button>
        </>
      );
    }
    renderWithIntl(<Probe />);
    fireEvent.click(screen.getByText('limited'));
    fireEvent.click(screen.getByText('plain'));
    expect(seen).toEqual([true, false]);
  });
});
