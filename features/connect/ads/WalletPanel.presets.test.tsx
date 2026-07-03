import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { App as AntApp } from 'antd';
import en from '@/app/messages/en.json';
import WalletPanel from './WalletPanel';
import type { WalletView } from './ads.types';

// next/navigation router is unused in the render path but must exist.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
// The checkout module pulls in the Razorpay SDK loader; stub it for the render test.
vi.mock('./wallet-topup-checkout', () => ({
  purchaseWalletTopup: vi.fn(),
  CheckoutDismissedError: class extends Error {},
  CheckoutFailedError: class extends Error {},
}));

// Balance is a non-preset value so it never collides with a preset chip's text.
const wallet: WalletView = { balance: 7777, reserved: 0, grantBalance: 0 } as unknown as WalletView;

function renderPanel(props: Partial<React.ComponentProps<typeof WalletPanel>>) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <AntApp>
        <WalletPanel wallet={wallet} viewerName="Asha" {...props} />
      </AntApp>
    </NextIntlClientProvider>,
  );
}

describe('WalletPanel reads top-up presets + min from the live pricing config', () => {
  it('renders the admin-configured preset chips, not the built-in fallback', () => {
    renderPanel({ presets: [149, 499], minAmount: 149 });
    // Live presets appear as quick-pick buttons...
    expect(screen.getByRole('button', { name: '₹149' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '₹499' })).toBeInTheDocument();
    // ...and a built-in fallback preset NOT in the live set has no chip.
    expect(screen.queryByRole('button', { name: '₹1,000' })).toBeNull();
  });

  it('falls back to the built-in presets when none are supplied', () => {
    renderPanel({});
    // Built-in fallback set is [99, 299, 500, 1000].
    expect(screen.getByRole('button', { name: '₹99' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '₹1,000' })).toBeInTheDocument();
  });
});
