import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';
import { DeletionScheduledNotice } from './DeletionScheduledNotice';

/**
 * Pending-deletion notice shown in place of the delete action once a scope is
 * scheduled. States the recover-by date and that recovery is by contacting Zari
 * (no self-undo). Cross-link: account-deletion danger zones + suspended login copy.
 */

const messages = {
  accountDeletion: {
    scheduled: {
      title: 'Scheduled for deletion',
      body: 'This will be permanently deleted on {date}.',
      recover: 'Changed your mind? Contact us before then to recover. There is no self-undo.',
      contactCta: 'Contact us to recover',
    },
  },
};

function renderNotice(purgeAfter: string) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DeletionScheduledNotice purgeAfter={purgeAfter} />
    </NextIntlClientProvider>,
  );
}

describe('DeletionScheduledNotice', () => {
  afterEach(cleanup);

  it('shows the recover-by year and the no-self-undo recovery copy', () => {
    renderNotice('2026-07-25T12:00:00.000Z');
    expect(screen.getByText('Scheduled for deletion')).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
    expect(screen.getByText(/no self-undo/i)).toBeInTheDocument();
  });

  it('links the recovery CTA to the published grievance contact', () => {
    renderNotice('2026-07-25T12:00:00.000Z');
    const cta = screen.getByRole('link', { name: 'Contact us to recover' });
    // Links to the on-site /grievance page (DELETION_CONTACT_PATH) — no email is
    // hardcoded; the page shows the env-configured grievance mailbox.
    expect(cta).toHaveAttribute('href', '/grievance');
  });
});
