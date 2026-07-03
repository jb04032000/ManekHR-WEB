import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import ConnectAvatar from './ConnectAvatar';

// Inline messages mirror the real connect.profile.intents.ribbon.* keys (en).
const messages = {
  connect: { profile: { intents: { ribbon: { work: 'OPEN TO WORK', hiring: 'HIRING' } } } },
};
const wrap = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );

describe('ConnectAvatar', () => {
  it('renders bare avatar with no status label when status is null', () => {
    wrap(<ConnectAvatar name="Asha Patel" status={null} />);
    expect(screen.queryByText('OPEN TO WORK')).not.toBeInTheDocument();
    expect(screen.queryByText('HIRING')).not.toBeInTheDocument();
  });

  it('shows the HIRING pill at large size', () => {
    wrap(<ConnectAvatar name="Asha Patel" status="hiring" size={96} />);
    expect(screen.getByText('HIRING')).toBeInTheDocument();
  });

  it('shows the OPEN TO WORK pill at large size', () => {
    wrap(<ConnectAvatar name="Asha Patel" status="work" size={96} />);
    expect(screen.getByText('OPEN TO WORK')).toBeInTheDocument();
  });

  it('hides the visible pill at small size but keeps the status accessible', () => {
    wrap(<ConnectAvatar name="Asha Patel" status="hiring" size={32} />);
    // Only the sr-only node carries the label at small size, never a visible pill.
    const labels = screen.getAllByText('HIRING');
    expect(labels).toHaveLength(1);
    expect(labels[0]).toHaveClass('sr-only');
  });

  it('forces ring-only (no visible pill) when hideLabel is set even at large size', () => {
    wrap(<ConnectAvatar name="Asha Patel" status="hiring" size={96} hideLabel />);
    const labels = screen.getAllByText('HIRING');
    expect(labels).toHaveLength(1);
    expect(labels[0]).toHaveClass('sr-only');
  });
});
