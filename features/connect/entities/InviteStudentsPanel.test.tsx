import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App as AntApp } from 'antd';
import { renderWithIntl, screen, fireEvent, waitFor } from '@/test-utils/render';
import type { BulkInviteResult, PageInviteSummary } from './entities.types';

/**
 * InviteStudentsPanel tests - the bulk student-invite flow. Server actions +
 * next/navigation are mocked. Covers: parses pasted phones (newline / comma),
 * calls bulkInviteStudents, renders the result counts + a wa.me link per created
 * invite (via WhatsAppCTA.buildWhatsAppHref), and shows the joined / pending
 * summary header.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const bulkInviteStudents = vi.fn();
const getStudentInviteSummary = vi.fn();
vi.mock('./company-page.actions', () => ({
  bulkInviteStudents: (...a: unknown[]) => bulkInviteStudents(...a),
  getStudentInviteSummary: (...a: unknown[]) => getStudentInviteSummary(...a),
}));

import InviteStudentsPanel, { parsePhones } from './InviteStudentsPanel';

const SUMMARY: PageInviteSummary = { joinedCount: 7, pendingCount: 3 };

function renderPanel(summary: PageInviteSummary = SUMMARY) {
  return renderWithIntl(
    <AntApp>
      <InviteStudentsPanel
        pageId="cp-1"
        pageName="Surat Textile Institute"
        initialSummary={summary}
      />
    </AntApp>,
  );
}

describe('parsePhones', () => {
  it('splits on newlines, commas, and semicolons, trims, drops empties, de-dupes', () => {
    expect(parsePhones('9876543210\n9876543211, 9876543212; 9876543210')).toEqual([
      '9876543210',
      '9876543211',
      '9876543212',
    ]);
  });

  it('returns an empty array for blank input', () => {
    expect(parsePhones('   \n  ')).toEqual([]);
  });
});

describe('InviteStudentsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the joined and pending summary numbers', () => {
    renderPanel();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Students joined from your invites')).toBeInTheDocument();
    expect(screen.getByText('Invites pending')).toBeInTheDocument();
  });

  it('parses pasted phones, calls bulkInviteStudents, and renders the result counts', async () => {
    bulkInviteStudents.mockResolvedValue({
      ok: true,
      data: {
        created: 2,
        skipped: 1,
        invalid: 0,
        invites: [
          { mobile: '919876543210', token: 'tok-a' },
          { mobile: '919876543211', token: 'tok-b' },
        ],
      } satisfies BulkInviteResult,
    });
    getStudentInviteSummary.mockResolvedValue({
      ok: true,
      data: { joinedCount: 7, pendingCount: 5 },
    });
    renderPanel();

    const textarea = screen.getByLabelText('Phone numbers');
    fireEvent.change(textarea, {
      target: { value: '919876543210\n919876543211, 919876543210' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send invites' }));

    await waitFor(() => {
      // De-duped to two distinct numbers.
      expect(bulkInviteStudents).toHaveBeenCalledWith('cp-1', ['919876543210', '919876543211']);
    });

    // Result counts line.
    await waitFor(() => {
      expect(screen.getByText('2 created, 1 skipped, 0 invalid.')).toBeInTheDocument();
    });
  });

  it('renders a wa.me hand-off link per created invite', async () => {
    bulkInviteStudents.mockResolvedValue({
      ok: true,
      data: {
        created: 1,
        skipped: 0,
        invalid: 0,
        invites: [{ mobile: '+91 98765 43210', token: 'tok-a' }],
      } satisfies BulkInviteResult,
    });
    getStudentInviteSummary.mockResolvedValue({ ok: true, data: SUMMARY });
    renderPanel();

    fireEvent.change(screen.getByLabelText('Phone numbers'), {
      target: { value: '+91 98765 43210' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send invites' }));

    const link = await screen.findByRole('link', { name: 'Send on WhatsApp' });
    // buildWhatsAppHref strips non-digits from the phone into the wa.me path.
    expect(link).toHaveAttribute('href', expect.stringContaining('https://wa.me/919876543210'));
    // The institute name is woven into the url-encoded prefill text.
    expect(link.getAttribute('href')).toContain('Surat');
  });
});
