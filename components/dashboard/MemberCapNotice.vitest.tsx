import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';
import React from 'react';
import { MemberCapNotice } from '@/components/dashboard/MemberCapNotice';

// Real label strings for the keys the component reads (dashboard.upgrade.cap.*
// + dashboard.upgrade.cta) so we can assert on rendered copy + interpolation.
const messages = {
  dashboard: {
    upgrade: {
      cta: 'Upgrade',
      cap: {
        title: 'Showing {visibleCount} of {totalCount} team members — your plan includes {limit}.',
        body: 'Upgrade to see everyone.',
      },
    },
  },
};

afterEach(cleanup);

function renderNotice(props: React.ComponentProps<typeof MemberCapNotice>) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <MemberCapNotice {...props} />
    </NextIntlClientProvider>,
  );
}

describe('MemberCapNotice', () => {
  it('renders the interpolated count + CTA when capped', () => {
    renderNotice({ capped: true, visibleCount: 5, totalCount: 12, limit: 5 });
    // ICU placeholders filled with the real values.
    expect(
      screen.getByText(/Showing 5 of 12 team members — your plan includes 5\./),
    ).toBeInTheDocument();
    expect(screen.getByText('Upgrade to see everyone.')).toBeInTheDocument();
    // Upgrade CTA links to the in-app plans hub.
    const cta = screen.getByRole('link', { name: /Upgrade/i });
    expect(cta).toHaveAttribute('href', '/account/subscription/plans');
  });

  it('renders nothing when not capped', () => {
    const { container } = renderNotice({
      capped: false,
      visibleCount: 5,
      totalCount: 5,
      limit: 5,
    });
    expect(container).toBeEmptyDOMElement();
  });
});
