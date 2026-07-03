/**
 * ConnectPromotionsConsole -- unit tests (RTL + vitest).
 *
 * Covers: renders the credit-drop history + Connect coupons, empty states, the
 * "New credit drop" modal, and a subscribers-mode drop submit calling the action.
 *
 * Server actions (promotions-admin + @/lib/actions used by CouponEditor) are
 * mocked before the subject import, mirroring BoostResults.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, waitFor } from '@testing-library/react';
import { renderWithIntl, screen } from '@/test-utils/render';
import type { Coupon } from '@/types';
import type { CreditDrop } from './promotions.types';

const createCreditDropMock = vi.fn();
const listCreditDropsMock = vi.fn();

vi.mock('./promotions-admin.actions', () => ({
  createCreditDrop: (...a: unknown[]) => createCreditDropMock(...a),
  listCreditDrops: (...a: unknown[]) => listCreditDropsMock(...a),
}));

vi.mock('@/lib/actions', () => ({
  adminListCoupons: vi.fn(async () => ({ items: [], total: 0, limit: 200, offset: 0 })),
  adminCreateCoupon: vi.fn(),
  adminUpdateCoupon: vi.fn(),
  getAdminPlans: vi.fn(async () => []),
}));

import ConnectPromotionsConsole from './ConnectPromotionsConsole';

const PLANS = [{ _id: 'plan-c1', name: 'Connect Premium', tier: 'premium' }];

const DROP: CreditDrop = {
  _id: 'drop-1',
  amountPerUser: 100,
  note: 'Diwali seller gift',
  expiresAt: null,
  targetMode: 'subscribers',
  planId: null,
  targetUserIds: [],
  recipientCount: 12,
  totalCreditsGranted: 1200,
  createdBy: 'admin-1',
  createdAt: '2026-05-30T10:00:00.000Z',
};

const COUPON: Coupon = {
  _id: 'coup-1',
  code: 'CONNECT20',
  discountType: 'percentage',
  valueOrPaise: 20,
  redemptionsCount: 3,
  isFirstTimeOnly: true,
  isStackable: false,
  applicablePlanIds: ['plan-c1'],
  applicableBillingCycles: [],
  isActive: true,
};

describe('ConnectPromotionsConsole', () => {
  beforeEach(() => {
    createCreditDropMock.mockReset();
    listCreditDropsMock.mockReset();
  });

  it('renders the credit-drop history and Connect coupons', () => {
    renderWithIntl(
      <ConnectPromotionsConsole
        initialDrops={[DROP]}
        initialCoupons={[COUPON]}
        connectPlans={PLANS}
      />,
    );
    expect(screen.getByText('Diwali seller gift')).toBeInTheDocument();
    expect(screen.getByText('CONNECT20')).toBeInTheDocument();
    // intro-offer marker for a first-time-only coupon
    expect(screen.getByText('First payment')).toBeInTheDocument();
  });

  it('shows empty states when there is no data', () => {
    renderWithIntl(
      <ConnectPromotionsConsole initialDrops={[]} initialCoupons={[]} connectPlans={PLANS} />,
    );
    expect(screen.getByText('No credit drops yet.')).toBeInTheDocument();
    expect(screen.getByText(/No Connect discounts yet/i)).toBeInTheDocument();
  });

  it('opens the New credit drop modal', async () => {
    renderWithIntl(
      <ConnectPromotionsConsole initialDrops={[]} initialCoupons={[]} connectPlans={PLANS} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /New credit drop/i }));
    await waitFor(() => expect(screen.getByText('Credits per seller')).toBeInTheDocument());
    expect(screen.getByText('Who gets it')).toBeInTheDocument();
  });

  it('submits a subscribers-mode drop via the action', async () => {
    createCreditDropMock.mockResolvedValue({
      ok: true,
      data: { ...DROP, _id: 'drop-2', recipientCount: 5, totalCreditsGranted: 500 },
    });
    listCreditDropsMock.mockResolvedValue({ ok: true, data: [DROP] });

    renderWithIntl(
      <ConnectPromotionsConsole initialDrops={[]} initialCoupons={[]} connectPlans={PLANS} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /New credit drop/i }));
    await waitFor(() => expect(screen.getByText('Credits per seller')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('e.g. Diwali 2026 seller gift'), {
      target: { value: 'Test gift' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Grant credits' }));

    await waitFor(() => expect(createCreditDropMock).toHaveBeenCalledTimes(1));
    expect(createCreditDropMock).toHaveBeenCalledWith(
      expect.objectContaining({ targetMode: 'subscribers', note: 'Test gift', amountPerUser: 100 }),
    );
  });
});
