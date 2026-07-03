/**
 * HireCandidatesModal test (Institutes Phase 2, Feature 4): the business's
 * "Hire our trained candidates" composer. Verifies the modal opens, submits the
 * message through the mocked `sendHireLead` action, shows the success panel on
 * ok, and surfaces the self-lead error copy distinctly from a generic failure.
 *
 * Cross-module: the modal posts via company-page.actions `sendHireLead` (mocked
 * here so the test never imports the server-only client) and the seeded thread
 * renders as inbox/ContextCard's CandidateRequestCard (covered separately).
 * Watch: keep the `selfLead` / `generic` branches in sync with HireLeadErrorCode.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, waitFor } from '@testing-library/react';
import { renderWithIntl, screen } from '@/test-utils/render';
import HireCandidatesModal from './HireCandidatesModal';

// Mock the server action so the test asserts the call + drives the result
// (ok / selfLead) without touching server-only code.
const sendHireLead = vi.fn();
vi.mock('./company-page.actions', () => ({
  sendHireLead: (...a: unknown[]) => sendHireLead(...(a as [])),
}));

beforeEach(() => vi.clearAllMocks());

function renderModal() {
  return renderWithIntl(
    <HireCandidatesModal
      pageId="P5"
      instituteName="Surat Textile Institute"
      open
      onClose={() => undefined}
    />,
  );
}

describe('HireCandidatesModal', () => {
  it('opens with the composer form (title + send button)', () => {
    sendHireLead.mockResolvedValue({ ok: true });
    renderModal();
    expect(screen.getByText('Hire trained candidates')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send to institute' })).toBeInTheDocument();
  });

  it('submits the message, calls sendHireLead, and shows the sent panel on ok', async () => {
    sendHireLead.mockResolvedValue({ ok: true });
    renderModal();
    const textarea = screen.getByPlaceholderText(/power-loom operators/);
    fireEvent.change(textarea, { target: { value: 'We need 3 operators in Surat.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send to institute' }));
    await waitFor(() =>
      expect(sendHireLead).toHaveBeenCalledWith('P5', 'We need 3 operators in Surat.'),
    );
    // Success panel: the sentTitle + sentBody replace the form.
    expect(await screen.findByText('Sent')).toBeInTheDocument();
    expect(
      screen.getByText('Your message reached the institute. Check your inbox for their reply.'),
    ).toBeInTheDocument();
  });

  it('surfaces the self-lead error copy when sendHireLead returns the selfLead code', async () => {
    sendHireLead.mockResolvedValue({ ok: false, code: 'selfLead', error: 'self' });
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Send to institute' }));
    expect(
      await screen.findByText(
        'This is your own institute page, so you cannot send yourself a hiring request.',
      ),
    ).toBeInTheDocument();
    // It stays on the form (no success panel), so the sender can correct.
    expect(screen.queryByText('Sent')).not.toBeInTheDocument();
  });

  it('surfaces a friendly generic error for any other failure', async () => {
    sendHireLead.mockResolvedValue({ ok: false, code: 'generic', error: 'boom' });
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Send to institute' }));
    expect(
      await screen.findByText('Could not send your message. Please try again.'),
    ).toBeInTheDocument();
  });
});
