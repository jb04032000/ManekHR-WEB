import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App as AntApp } from 'antd';
import { renderWithIntl, screen, fireEvent, waitFor } from '@/test-utils/render';
import type { PendingCredentialRequest } from './entities.types';

/**
 * CredentialRequestsPanel tests - the institute credential-review queue.
 * Server actions + next/navigation are mocked so the panel is exercised against
 * deterministic data (no network, no router). Mirrors the InvitationsTab test
 * pattern (busyIds optimistic remove + router.refresh on success).
 */

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const confirmCredential = vi.fn();
const declineCredential = vi.fn();
vi.mock('./company-page.actions', () => ({
  confirmCredential: (...a: unknown[]) => confirmCredential(...a),
  declineCredential: (...a: unknown[]) => declineCredential(...a),
}));

import CredentialRequestsPanel from './CredentialRequestsPanel';

function req(over: Partial<PendingCredentialRequest> = {}): PendingCredentialRequest {
  return {
    student: { userId: 'u-1', name: 'Imran Sheikh', avatar: null, handle: 'imran' },
    training: {
      id: 't-1',
      instituteName: 'Surat Textile Institute',
      companyPageId: 'cp-1',
      course: 'Aari embroidery',
      completedAt: '2026-04-01T00:00:00.000Z',
      certificateUrl: null,
      confirmStatus: 'pending',
      confirmedAt: null,
      shareWithInstitute: true,
    },
    company: { id: 'cp-1', name: 'Surat Textile Institute', slug: 'surat-textile', logo: '' },
    ...over,
  };
}

function renderPanel(requests: PendingCredentialRequest[], onGoToInvite = vi.fn()) {
  return renderWithIntl(
    <AntApp>
      <CredentialRequestsPanel
        pageId="cp-1"
        initialRequests={requests}
        onGoToInvite={onGoToInvite}
      />
    </AntApp>,
  );
}

describe('CredentialRequestsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a row with the student identity + the course and institute name', () => {
    renderPanel([req()]);
    expect(screen.getByText('Imran Sheikh')).toBeInTheDocument();
    expect(screen.getByText('@imran')).toBeInTheDocument();
    expect(screen.getByText('Aari embroidery')).toBeInTheDocument();
    // The institute name is rendered alongside the course (·-joined).
    expect(screen.getByText(/Surat Textile Institute/)).toBeInTheDocument();
  });

  it('confirms a request, calls the action with the right ids, drops the row, refreshes', async () => {
    confirmCredential.mockResolvedValue({ ok: true, data: { ok: true } });
    renderPanel([req()]);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(confirmCredential).toHaveBeenCalledWith('cp-1', 'u-1', 't-1');
    });
    await waitFor(() => {
      expect(screen.queryByText('Imran Sheikh')).not.toBeInTheDocument();
    });
    expect(refresh).toHaveBeenCalled();
  });

  it('declines a request, calls the decline action, and drops the row', async () => {
    declineCredential.mockResolvedValue({ ok: true, data: { ok: true } });
    renderPanel([req()]);

    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));

    await waitFor(() => {
      expect(declineCredential).toHaveBeenCalledWith('cp-1', 'u-1', 't-1');
    });
    await waitFor(() => {
      expect(screen.queryByText('Imran Sheikh')).not.toBeInTheDocument();
    });
  });

  it('keeps the row when a confirm fails', async () => {
    confirmCredential.mockResolvedValue({ ok: false, error: 'Network down' });
    renderPanel([req()]);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(confirmCredential).toHaveBeenCalled();
    });
    expect(screen.getByText('Imran Sheikh')).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('shows the empty state with an Invite CTA when there are no requests', () => {
    const onGoToInvite = vi.fn();
    renderPanel([], onGoToInvite);
    expect(screen.getByText('No pending requests')).toBeInTheDocument();
    const cta = screen.getByRole('button', { name: 'Invite students' });
    fireEvent.click(cta);
    expect(onGoToInvite).toHaveBeenCalled();
  });
});
