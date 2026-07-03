import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';
import { ScheduledDeletionLoginNotice } from './ScheduledDeletionLoginNotice';

/**
 * Shown on the login screen when a suspended account is scheduled for deletion
 * (backend 403 code ACCOUNT_SCHEDULED_FOR_DELETION, plan §A.2). Renders the
 * backend's "scheduled on {date} - contact us to recover" message + a recovery
 * contact link. Recovery is admin-mediated; there is no self-undo.
 */

const messages = {
  accountDeletion: { scheduled: { contactCta: 'Contact us to recover' } },
};

function renderNotice(message: string) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ScheduledDeletionLoginNotice message={message} />
    </NextIntlClientProvider>,
  );
}

describe('ScheduledDeletionLoginNotice', () => {
  afterEach(cleanup);

  it('shows the backend message and a recovery contact link', () => {
    renderNotice('Your account is scheduled for deletion on 2026-07-25. Contact us to recover.');
    expect(screen.getByText(/scheduled for deletion on 2026-07-25/i)).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: 'Contact us to recover' });
    // Links to the on-site /grievance page (DELETION_CONTACT_PATH) — no email is
    // hardcoded; the page shows the env-configured grievance mailbox.
    expect(cta).toHaveAttribute('href', '/grievance');
  });
});
